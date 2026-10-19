/**
 * Runs once when the server process starts (not during `next build`).
 * Checks the configuration, and warms up the password hasher so the first sign-in
 * with an unknown email does not take longer than later ones.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertEnvironment } = await import("./lib/startup");
  assertEnvironment();
  const { dummyHash } = await import("./lib/auth");
  void dummyHash();
}
