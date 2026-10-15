import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth";
import { listHidden, listOpenReports } from "@/lib/report";
import TopBar from "@/components/TopBar";
import ModerationActions from "@/components/ModerationActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports — learnai admin" };

export default async function Reports() {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin/reports");
  }
  const session = await getSession();
  const [open, hidden] = await Promise.all([listOpenReports(), listHidden()]);
  const openKeys = new Set(open.map((o) => o.kind + o.id));
  const onlyHidden = hidden.filter((h) => !openKeys.has(h.kind + h.id));

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <div className="settings" style={{ maxWidth: 900 }}>
          <div className="kick" style={{ marginBottom: 6 }}><Link href="/admin">← Admin</Link></div>
          <h1 className="serif" style={{ fontSize: 28 }}>Reports</h1>
          <p className="set-sub">Posts people reported. Three different people reporting one post hides it until you decide. Hidden posts are invisible to everyone except their author, and stop counting toward holds, stakes and points.</p>

          <h2 style={{ marginTop: 26, fontSize: 15 }}>Open reports ({open.length})</h2>
          {open.length === 0 && <p style={{ color: "var(--fg-mute)" }}>Nothing to review.</p>}
          {open.map((r) => (
            <section key={r.kind + r.id} className="set-card">
              <h2>
                {r.kind} on {r.node} <span className="qa-tag">by {r.author}</span>{" "}
                <span className={`qa-verdict ${r.hidden ? "v-incorrect" : "v-unsure"}`}>
                  {r.hidden ? `hidden (${r.hiddenBy === "AUTO" ? "automatically" : "by an admin"})` : "visible"}
                </span>
              </h2>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.text}</p>
              <ul className="exp-list" style={{ marginBottom: 6 }}>
                {r.reports.map((x, i) => (
                  <li key={i} style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span><b>{x.reason.toLowerCase().replace("_", " ")}</b> <span className="qa-meta">reported by {x.reporter}</span></span>
                    {x.note && <span className="qa-meta">{x.note}</span>}
                  </li>
                ))}
              </ul>
              <ModerationActions kind={r.kind} id={r.id} hidden={r.hidden} hasReports />
            </section>
          ))}

          <h2 style={{ marginTop: 30, fontSize: 15 }}>Hidden with no open report ({onlyHidden.length})</h2>
          {onlyHidden.map((r) => (
            <section key={r.kind + r.id} className="set-card">
              <h2>{r.kind} on {r.node} <span className="qa-tag">by {r.author}</span></h2>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{r.text}</p>
              <ModerationActions kind={r.kind} id={r.id} hidden hasReports={false} />
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
