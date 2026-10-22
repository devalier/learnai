import type { Metadata } from "next";
import "./globals.css";
import CookieNotice from "@/components/CookieNotice";
import PolicyNotice from "@/components/PolicyNotice";

export const metadata: Metadata = {
  metadataBase: new URL("https://learnai.devalier.com"),
  title: "learnai — social graph learning for business",
  description:
    "Understand AI, use it sensibly, spot misleading claims, and explain the essentials. Free. No technical background needed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PolicyNotice />
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
