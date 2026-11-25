import { prisma } from "./db";
import { logger } from "./log";
import { PROVIDERS, type ChatConfig, type ProviderId, isProviderId } from "./aiproviders";
import { decryptSecret, encryptSecret, secretHint, SecretBoxError } from "./secretbox";

/**
 * Which AI the site uses. The admin pane (/admin/ai) writes one AiSetting row; with no
 * row, MISTRAL_API_KEY / MISTRAL_MODEL from the environment still work, as before.
 *
 * The row is read on every use, uncached: it is one primary-key lookup, next to an AI
 * call that takes seconds, and a change applies at once on every page and route.
 */

const ROW = "default";
const AAD = `AiSetting:${ROW}`;

export type AiStatus = {
  source: "admin" | "environment" | "none";
  provider: ProviderId | null;
  model: string;
  endpoint: string;
  keyHint: string;
  /** Set when a stored key exists but cannot be decrypted (AUTH_SECRET or AI_ENCRYPTION_KEY changed). */
  problem: string;
  updatedAt: string | null;
};

async function resolve(): Promise<{ config: ChatConfig | null; status: AiStatus }> {
  const row = await prisma.aiSetting.findUnique({ where: { id: ROW } });
  if (row && isProviderId(row.provider)) {
    const status: AiStatus = {
      source: "admin",
      provider: row.provider,
      model: row.model,
      endpoint: row.endpoint,
      keyHint: row.keyHint,
      problem: "",
      updatedAt: row.updatedAt.toISOString(),
    };
    let key = "";
    if (row.keyCiphertext) {
      try {
        key = decryptSecret(row.keyCiphertext, AAD);
      } catch (e) {
        if (!(e instanceof SecretBoxError)) throw e;
        status.problem = "The stored API key can no longer be decrypted (the server's AUTH_SECRET or AI_ENCRYPTION_KEY changed). Enter the key again.";
        logger.error("ai_key_undecryptable");
        return { config: null, status };
      }
    }
    if (PROVIDERS[row.provider].requiresKey && !key) {
      status.problem = "No API key is stored.";
      return { config: null, status };
    }
    return { config: { provider: row.provider, model: row.model, key, endpoint: row.endpoint }, status };
  }

  const env = process.env;
  if (env.MISTRAL_API_KEY) {
    // MISTRAL_BASE_URL is a test-only override (a mock server), so it goes through as the endpoint.
    const config: ChatConfig = {
      provider: "mistral",
      model: env.MISTRAL_MODEL || "mistral-small-latest",
      key: env.MISTRAL_API_KEY,
      endpoint: env.MISTRAL_BASE_URL ?? "",
    };
    return {
      config,
      status: { source: "environment", provider: "mistral", model: config.model, endpoint: "", keyHint: secretHint(env.MISTRAL_API_KEY), problem: "", updatedAt: null },
    };
  }
  return { config: null, status: { source: "none", provider: null, model: "", endpoint: "", keyHint: "", problem: "", updatedAt: null } };
}

/** What the AI calls use, or null when the AI is unavailable. */
export async function aiConfig(): Promise<ChatConfig | null> {
  return (await resolve()).config;
}

/** For the admin pane, the privacy notice and the footer. Never contains the key. */
export async function aiStatus(): Promise<AiStatus> {
  return (await resolve()).status;
}

/**
 * The key currently stored for `provider`, if any: lets an admin change model without
 * re-typing it. For a self-hosted server only at the same endpoint, so a stored key is
 * never sent to an address it was not saved for.
 */
export async function storedKeyFor(provider: ProviderId, endpoint: string): Promise<string> {
  const row = await prisma.aiSetting.findUnique({ where: { id: ROW } });
  if (!row || row.provider !== provider || !row.keyCiphertext || row.endpoint !== endpoint) return "";
  try {
    return decryptSecret(row.keyCiphertext, AAD);
  } catch {
    return "";
  }
}

export async function saveAiSetting(s: { provider: ProviderId; model: string; endpoint: string; key: string }, adminId: string): Promise<void> {
  const data = {
    provider: s.provider,
    model: s.model,
    endpoint: s.endpoint,
    keyCiphertext: s.key ? encryptSecret(s.key, AAD) : null,
    keyHint: s.key ? secretHint(s.key) : "",
    updatedById: adminId,
  };
  await prisma.aiSetting.upsert({ where: { id: ROW }, create: { id: ROW, ...data }, update: data });
  logger.info("ai_setting_saved", { provider: s.provider, model: s.model, by: adminId });
}

export async function clearAiSetting(adminId: string): Promise<void> {
  await prisma.aiSetting.deleteMany({ where: { id: ROW } });
  logger.info("ai_setting_cleared", { by: adminId });
}
