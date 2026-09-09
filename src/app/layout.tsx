import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://learnai.devalier.com"),
  title: "learnai.devalier — Learn AI for real decisions",
  description:
    "Practical AI for public administration: learn how it works, then apply it to strategy and decisions — two days learning, thirty days practice.",
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
