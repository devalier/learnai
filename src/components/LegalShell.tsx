import Link from "next/link";
import { getSession } from "@/lib/auth";
import TopBar from "./TopBar";
import { POLICY_VERSION } from "@/lib/legal";

export default async function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  const session = await getSession();
  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <article className="legal">
          <h1 className="serif">{title}</h1>
          <p className="legal-meta">Version {POLICY_VERSION}</p>
          {children}
          <p className="legal-nav">
            <Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms</Link> ·{" "}
            <Link href="/cookies">Cookies</Link>
          </p>
        </article>
      </div>
    </>
  );
}
