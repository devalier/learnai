import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { MAX_PASSWORD_BYTES, hashPassword } from "./auth";
import { MailNotConfigured, appUrl, sendMail } from "./mail";

/**
 * Password reset by emailed link.
 *  - The same answer whether or not the email has an account (no user enumeration),
 *    and the work happens after the response so timing does not give it away either.
 *  - The token is 256 random bits; only its SHA-256 is stored. It works once and
 *    expires after an hour. Asking again invalidates the older links.
 *  - A reset signs out every existing session (see getSession: passwordChangedAt and sessionVersion).
 *  - At most 3 requests per account per hour.
 */

const HOUR = 60 * 60 * 1000;
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export class ResetError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Create a reset and email the link. Silent if the account does not exist or is rate-limited. */
export async function requestReset(rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return;
  const recent = await prisma.passwordReset.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - HOUR) } } });
  if (recent >= 3) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // Older links stop working. Rows are kept for a day (the hourly limit counts them), then cleared out.
    prisma.passwordReset.deleteMany({ where: { userId: user.id, createdAt: { lt: new Date(Date.now() - 24 * HOUR) } } }),
    prisma.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + HOUR) } }),
  ]);
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  try {
    await sendMail(
      user.email,
      "Reset your learnai password",
      `Hello ${user.name.split(/\s+/)[0]},\n\nSomeone asked to reset the password for your learnai account. To choose a new one, open this link within one hour:\n\n${link}\n\nIf it was not you, ignore this email: your password stays as it is.\n\nlearnai`
    );
  } catch (e) {
    console.error(e instanceof MailNotConfigured ? "Password reset requested but SMTP is not configured." : "Password reset email failed:", (e as Error).message);
  }
}

/** Is this token usable right now? (For the reset page, before showing the form.) */
export async function checkToken(token: string): Promise<boolean> {
  if (!token) return false;
  const r = await prisma.passwordReset.findUnique({ where: { tokenHash: sha(token) }, select: { usedAt: true, expiresAt: true } });
  return !!r && !r.usedAt && r.expiresAt > new Date();
}

export async function resetPassword(token: string, password: unknown): Promise<void> {
  if (typeof password !== "string" || password.length < 8) throw new ResetError("WEAK_PASSWORD", "Password must be at least 8 characters.");
  if (Buffer.byteLength(password) > MAX_PASSWORD_BYTES) throw new ResetError("WEAK_PASSWORD", `Password must be at most ${MAX_PASSWORD_BYTES} bytes (about ${MAX_PASSWORD_BYTES} characters).`);
  const r = token ? await prisma.passwordReset.findUnique({ where: { tokenHash: sha(token) } }) : null;
  if (!r || r.usedAt || r.expiresAt <= new Date())
    throw new ResetError("BAD_TOKEN", "This reset link is invalid or has expired. Ask for a new one.");
  const now = new Date();
  const hash = await hashPassword(password);
  // Claim the token first so two uses of it cannot both succeed.
  const claimed = await prisma.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw new ResetError("BAD_TOKEN", "This reset link is invalid or has expired. Ask for a new one.");
  await prisma.$transaction([
    prisma.user.update({ where: { id: r.userId }, data: { passwordHash: hash, passwordChangedAt: now, sessionVersion: { increment: 1 } } }),
    prisma.passwordReset.updateMany({ where: { userId: r.userId, usedAt: null }, data: { usedAt: now } }),
  ]);
}
