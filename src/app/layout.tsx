import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ai.devalier — Learn AI for real decisions",
  description:
    "A working map for decision-makers: two days of mechanism, evals and brownfield reality, then thirty days of forced use.",
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
