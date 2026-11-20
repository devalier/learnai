/**
 * Tests for the AI provider layer that need no network and no database:
 * key encryption, model-list parsing, reply extraction, endpoint vetting, and the
 * chat request shape against a local mock server.
 *
 *   npm run test:ai
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { decryptSecret, encryptSecret, secretHint } from "../src/lib/secretbox";
import { chatJson, checkEndpoint, extractJson, parseModels } from "../src/lib/aiproviders";

const env = { AUTH_SECRET: "k".repeat(8) + "Zq3!vR9#mT2@pL7$wX4%nB6^yH8&jD1*" };
const other = { AUTH_SECRET: "a different secret that is long enough 123" };
let passed = 0;
async function test(name: string, fn: () => unknown) {
  await fn();
  passed++;
  console.log(`ok  ${name}`);
}

async function main() {
await test("encrypt/decrypt round-trips and hides the plaintext", () => {
  const blob = encryptSecret("sk-live-abcdef123456", "AiSetting:default", env);
  assert.ok(!blob.includes("abcdef"));
  assert.equal(decryptSecret(blob, "AiSetting:default", env), "sk-live-abcdef123456");
  assert.notEqual(encryptSecret("x".repeat(10), "a", env), encryptSecret("x".repeat(10), "a", env), "fresh IV each time");
});

await test("a ciphertext moved to another row, or read with another secret, fails", () => {
  const blob = encryptSecret("sk-live-abcdef123456", "AiSetting:default", env);
  assert.throws(() => decryptSecret(blob, "AiSetting:other", env), /could not be decrypted/);
  assert.throws(() => decryptSecret(blob, "AiSetting:default", other), /could not be decrypted/);
  assert.throws(() => decryptSecret(blob.slice(0, -3) + "AAA", "AiSetting:default", env), /could not be decrypted/);
});

await test("AI_ENCRYPTION_KEY, when set, takes precedence over AUTH_SECRET", () => {
  const withKey = { ...env, AI_ENCRYPTION_KEY: "e".repeat(4) + "separate-encryption-key-0123456789" };
  const blob = encryptSecret("secret-value-1", "r", withKey);
  assert.throws(() => decryptSecret(blob, "r", env));
  assert.equal(decryptSecret(blob, "r", { ...other, AI_ENCRYPTION_KEY: withKey.AI_ENCRYPTION_KEY }), "secret-value-1");
});

await test("a missing or short secret refuses to encrypt", () => {
  assert.throws(() => encryptSecret("x", "r", {}), /AUTH_SECRET/);
  assert.throws(() => encryptSecret("x", "r", { AUTH_SECRET: "short" }), /AUTH_SECRET/);
});

await test("hints show at most the last four characters", () => {
  assert.equal(secretHint("sk-1234567890wxyz"), "****wxyz");
  assert.equal(secretHint("short"), "****");
});

await test("model lists parse per provider and drop non-chat models", () => {
  assert.deepEqual(
    parseModels("mistral", { data: [{ id: "mistral-small-latest", max_context_length: 128000, capabilities: { completion_chat: true } }, { id: "mistral-embed", capabilities: { completion_chat: false } }, { id: "old", deprecation: "2025-01-01" }] }),
    [{ id: "mistral-small-latest", label: "128k context" }],
  );
  assert.deepEqual(parseModels("anthropic", { data: [{ id: "claude-sonnet-5-5", display_name: "Claude Sonnet 5.5" }] }), [{ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" }]);
  assert.deepEqual(parseModels("openai", { data: [{ id: "gpt-5.1" }, { id: "text-embedding-3-large" }, { id: "whisper-1" }] }).map((m) => m.id), ["gpt-5.1"]);
  assert.deepEqual(
    parseModels("openrouter", { data: [{ id: "a/text", name: "Text", pricing: { prompt: "0", completion: "0" } }, { id: "b/image", architecture: { output_modalities: ["image"] } }] }),
    [{ id: "a/text", label: "Text · free" }],
  );
  assert.deepEqual(parseModels("fireworks", { models: [{ name: "accounts/fireworks/models/x", displayName: "X" }, { name: "e", kind: "EMBEDDING_MODEL" }] }).map((m) => m.id), ["accounts/fireworks/models/x"]);
  assert.deepEqual(parseModels("deepseek", { nope: 1 }), []);
});

await test("replies with reasoning or a code fence still yield the JSON object", () => {
  assert.equal(extractJson('<think>hmm {"no":1}</think>\n```json\n{"ok": true}\n```'), '{"ok": true}');
  assert.equal(extractJson('Sure! {"a": {"b": 1}} Hope that helps.'), '{"a": {"b": 1}}');
});

await test("self-hosted endpoints: loopback, metadata, credentials and public http are refused", async () => {
  await assert.rejects(checkEndpoint("http://localhost:11434/v1"), /not allowed/);
  await assert.rejects(checkEndpoint("http://127.0.0.1:8000/v1"), /not allowed/);
  await assert.rejects(checkEndpoint("http://169.254.169.254/latest"), /not allowed/);
  await assert.rejects(checkEndpoint("http://[::1]:8000/v1"), /not allowed/);
  await assert.rejects(checkEndpoint("https://user:pw@10.0.0.5/v1"), /credentials/);
  await assert.rejects(checkEndpoint("http://8.8.8.8/v1"), /private network/);
  await assert.rejects(checkEndpoint("ftp://10.0.0.5/v1"), /https/);
  assert.equal(await checkEndpoint("http://10.0.0.5:8000/v1/chat/completions"), "http://10.0.0.5:8000/v1");
  assert.equal(await checkEndpoint("https://192.168.1.20/v1/"), "https://192.168.1.20/v1");
});

// A mock chat-completions server. The Mistral provider with an endpoint is the
// MISTRAL_BASE_URL test override, the one path allowed to reach loopback.
const seen: Record<string, unknown>[] = [];
let rejectTemperature = false;
const server = createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw);
    seen.push({ auth: req.headers.authorization, url: req.url, ...body });
    if (rejectTemperature && "temperature" in body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Unsupported parameter: 'temperature'" } }));
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: '```json\n{"ok": true}\n```' } }] }));
  });
});
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;

await test("chat sends the key, the model, JSON mode, and returns the JSON", async () => {
  const out = await chatJson({ provider: "mistral", model: "mistral-small-latest", key: "sk-test", endpoint: base }, "sys", "user");
  assert.equal(out, '{"ok": true}');
  const r = seen.at(-1)!;
  assert.equal(r.auth, "Bearer sk-test");
  assert.equal(r.url, "/v1/chat/completions");
  assert.equal(r.model, "mistral-small-latest");
  assert.deepEqual(r.response_format, { type: "json_object" });
});

await test("a parameter the model refuses is dropped and the call retried once", async () => {
  rejectTemperature = true;
  seen.length = 0;
  assert.equal(await chatJson({ provider: "mistral", model: "m", key: "k", endpoint: base }, "s", "u"), '{"ok": true}');
  assert.equal(seen.length, 2);
  assert.ok(!("temperature" in seen[1]));
  rejectTemperature = false;
});

server.close();
console.log(`\n${passed} tests passed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
