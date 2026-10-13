import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://learnai.devalier.com"),
  title: "learnai — social graph learning for business",
  description:
    "Learn how AI really works, then apply it to strategy and decisions: two days of grounding, thirty days of practice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
