import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Encryption for credentials stored in the database (the AI provider's API key).
 *
 * AES-256-GCM with a key derived by HKDF from AI_ENCRYPTION_KEY if it is set, else
 * from AUTH_SECRET, so no new secret is needed on the server. The consequence: if
 * AUTH_SECRET is rotated, a stored key can no longer be read, and an administrator
 * enters it again in the admin pane. Set AI_ENCRYPTION_KEY to make the two independent.
 *
 * `aad` binds a ciphertext to its row, so a value copied to another row fails to
 * decrypt instead of silently working. The plaintext is never logged or returned to
 * the browser; only `hint` (the last four characters) is shown.
 */

const SALT = "learnai.stored-credentials.v1";
const VERSION = "v1";

export class SecretBoxError extends Error {
  name = "SecretBoxError";
}

function key(env: Record<string, string | undefined> = process.env): Buffer {
  const root = env.AI_ENCRYPTION_KEY || env.AUTH_SECRET;
  if (!root || root.length < 32) throw new SecretBoxError("No encryption secret: set AUTH_SECRET (32+ characters).");
  return Buffer.from(hkdfSync("sha256", root, SALT, "aes-256-gcm", 32));
}

export function encryptSecret(plaintext: string, aad: string, env?: Record<string, string | undefined>): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(env), iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  const body = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return [VERSION, iv.toString("base64url"), body.toString("base64url"), c.getAuthTag().toString("base64url")].join(".");
}

export function decryptSecret(blob: string, aad: string, env?: Record<string, string | undefined>): string {
  try {
    const [v, iv, body, tag] = blob.split(".");
    if (v !== VERSION || !iv || !body || !tag) throw new Error("format");
    const d = createDecipheriv("aes-256-gcm", key(env), Buffer.from(iv, "base64url"));
    d.setAAD(Buffer.from(aad, "utf8"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    // Never pass cryptographic detail upward.
    throw new SecretBoxError("The stored credential could not be decrypted.");
  }
}

/** What the UI may show of a secret. */
export function secretHint(plaintext: string): string {
  return plaintext.length >= 8 ? `****${plaintext.slice(-4)}` : "****";
}
