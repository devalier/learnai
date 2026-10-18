import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth";
import { listOpenAppeals } from "@/lib/appeal";
import TopBar from "@/components/TopBar";
import AppealActions from "@/components/AppealActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appeals — learnai admin" };

const LETTERS = ["A", "B", "C", "D"];

export default async function Appeals() {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin/appeals");
  }
  const session = await getSession();
  const open = await listOpenAppeals();

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <div className="settings" style={{ maxWidth: 900 }}>
          <div className="kick" style={{ marginBottom: 6 }}><Link href="/admin">← Admin</Link></div>
          <h1 className="serif" style={{ fontSize: 28 }}>Appeals</h1>
          <p className="set-sub">People who got an answer marked wrong, asked the AI to re-check, and still disagree. Only the person who appealed and the admins can see these. Changing a quiz key or removing a question grades every attempt on that quiz again.</p>

          <h2 style={{ marginTop: 26, fontSize: 15 }}>Open appeals ({open.length})</h2>
          {open.length === 0 && <p style={{ color: "var(--fg-mute)" }}>Nothing to review.</p>}
          {open.map((a) => (
            <section key={a.kind + a.id} className="set-card">
              <h2>{a.kind === "answer" ? "Answer" : "Quiz question"} on {a.node} <span className="qa-tag">appealed by {a.who}</span></h2>
              <p className="qa-meta" style={{ marginBottom: 4 }}>Question</p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 0 }}>{a.question}</p>
              {a.kind === "answer" ? (
                <>
                  <p className="qa-meta" style={{ marginBottom: 4 }}>Their answer</p>
                  <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 0 }}>{a.answer}</p>
                  <p className="qa-meta">AI judgement: {a.aiReason}</p>
                </>
              ) : (
                <>
                  <ul className="exp-list" style={{ marginBottom: 6 }}>
                    {a.options.map((o, i) => (
                      <li key={i}>
                        <span>
                          <b>{LETTERS[i]}.</b> {o}
                          {i === a.key && <span className="qa-tag"> current key</span>}
                          {i === a.theirAnswer && <span className="qa-tag"> their answer</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {a.keyExplanation && <p className="qa-meta">AI explanation: {a.keyExplanation}</p>}
                </>
              )}
              {a.aiRecheck && <p className="qa-meta">AI re-check ({a.aiRecheck.outcome.toLowerCase().replace("_", " ")}): {a.aiRecheck.reason}</p>}
              <p className="qa-meta" style={{ marginBottom: 4 }}>Their appeal</p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 0 }}>{a.explanation}</p>
              <AppealActions kind={a.kind} id={a.id} {...(a.kind === "quiz" ? { options: a.options, currentKey: a.key } : {})} />
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
