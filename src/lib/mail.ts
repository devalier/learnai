import nodemailer from "nodemailer";

/**
 * Outgoing email (password resets). Plain SMTP, configured from the environment:
 *
 *   SMTP_HOST       required; without it no email can be sent
 *   SMTP_PORT       default 587
 *   SMTP_SECURE     "true" for implicit TLS (port 465); otherwise STARTTLS when offered
 *   SMTP_USER, SMTP_PASS
 *   MAIL_FROM       e.g. "learnai <no-reply@devalier.com>"
 *   APP_URL         public base URL used in links, default https://learnai.devalier.com
 */

export class MailNotConfigured extends Error {}

export const appUrl = () => (process.env.APP_URL || "https://learnai.devalier.com").replace(/\/+$/, "");

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) throw new MailNotConfigured("SMTP_HOST is not set");
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || "learnai <no-reply@devalier.com>", to, subject, text });
}
