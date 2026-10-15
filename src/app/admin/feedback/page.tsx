import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth";
import { resourceFeedback } from "@/lib/resourcevote";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resource feedback — learnai admin" };

export default async function Feedback() {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin/feedback");
  }
  const session = await getSession();
  const rows = await resourceFeedback();
  const rated = rows.filter((r) => r.up + r.down > 0).sort((a, b) => (b.up - b.down) - (a.up - a.down));
  const unrated = rows.filter((r) => r.up + r.down === 0);

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <div className="settings" style={{ maxWidth: 900 }}>
          <div className="kick" style={{ marginBottom: 6 }}><Link href="/admin">← Admin</Link></div>
          <h1 className="serif" style={{ fontSize: 28 }}>Resource feedback</h1>
          <p className="set-sub">
            Thumbs up and down from people with a verified hold on a topic the resource covers (earned by passing a quiz or
            answering correctly, not by ticking the resource). Totals only; individual votes are not shown here.
          </p>
          <table className="legal-table" style={{ marginTop: 18 }}>
            <thead><tr><th>Resource</th><th>Module</th><th>Type</th><th>👍</th><th>👎</th><th>Net</th></tr></thead>
            <tbody>
              {rated.map((r) => (
                <tr key={r.id}><td>{r.title}</td><td>{r.module}</td><td>{r.type}</td><td>{r.up}</td><td>{r.down}</td><td><b>{r.up - r.down}</b></td></tr>
              ))}
              {rated.length === 0 && <tr><td colSpan={6} style={{ color: "var(--fg-mute)" }}>No ratings yet.</td></tr>}
            </tbody>
          </table>
          {unrated.length > 0 && <p className="set-sub" style={{ marginTop: 14 }}>{unrated.length} resources have no ratings yet.</p>}
        </div>
      </div>
    </>
  );
}
