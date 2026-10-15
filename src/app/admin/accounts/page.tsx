import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth";
import { ACTIVE_DAYS, NEVER_STARTED_AFTER_DAYS, QUIET_DAYS, listAccounts, type Status } from "@/lib/accounts";
import TopBar from "@/components/TopBar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts — learnai admin" };

const LABEL: Record<Status, string> = { active: "Active", quiet: "Quiet", stale: "Stale", never_started: "Never started" };
const CLASS: Record<Status, string> = { active: "v-correct", quiet: "v-unsure", stale: "v-incorrect", never_started: "v-incorrect" };
const fmt = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "—");

export default async function Accounts({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin/accounts");
  }
  const session = await getSession();
  const { status } = await searchParams;
  const all = await listAccounts();
  const counts = { active: 0, quiet: 0, stale: 0, never_started: 0 } as Record<Status, number>;
  for (const a of all) counts[a.status]++;
  const filter = (["active", "quiet", "stale", "never_started"] as const).find((s) => s === status);
  // Stalest first: that is what this page is for.
  const rows = all.filter((a) => !filter || a.status === filter).sort((a, b) => b.idleDays - a.idleDays);

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <div className="settings" style={{ maxWidth: 1100 }}>
          <div className="kick" style={{ marginBottom: 6 }}><Link href="/admin">← Admin</Link></div>
          <h1 className="serif" style={{ fontSize: 28 }}>Accounts</h1>
          <p className="set-sub">
            <b>Active</b>: seen or active in the last {ACTIVE_DAYS} days. <b>Quiet</b>: {ACTIVE_DAYS + 1} to {QUIET_DAYS} days.{" "}
            <b>Stale</b>: more than {QUIET_DAYS} days. <b>Never started</b>: older than {NEVER_STARTED_AFTER_DAYS} days, signed in at most once, and
            never did anything. &ldquo;Last seen&rdquo; is any signed-in use (updated at most hourly); &ldquo;last activity&rdquo; is the newest tick, post or vote,
            so accounts that existed before tracking began still show up honestly.
          </p>
          <p style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "14px 0", fontSize: 13 }}>
            <Link className={`btn btn-sm ${!filter ? "btn-primary" : "btn-ghost"}`} href="/admin/accounts">All ({all.length})</Link>
            {(["stale", "never_started", "quiet", "active"] as const).map((s) => (
              <Link key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-ghost"}`} href={`/admin/accounts?status=${s}`}>
                {LABEL[s]} ({counts[s]})
              </Link>
            ))}
            <a className="btn btn-ghost btn-sm" href="/api/admin/accounts" download>Download CSV</a>
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="legal-table">
              <thead>
                <tr><th>Account</th><th>Status</th><th>Idle</th><th>Created</th><th>Last login</th><th>Last seen</th><th>Last activity</th><th>Logins</th><th>Ticks / holds / posts</th></tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}{a.role === "ADMIN" && " (admin)"}<br /><span className="qa-meta">{a.email}</span></td>
                    <td><span className={`qa-verdict ${CLASS[a.status]}`}>{LABEL[a.status]}</span></td>
                    <td>{a.idleDays} d</td>
                    <td>{fmt(a.createdAt)}</td>
                    <td>{fmt(a.lastLoginAt)}</td>
                    <td>{fmt(a.lastSeenAt)}</td>
                    <td>{fmt(a.lastActivityAt)}</td>
                    <td>{a.loginCount}</td>
                    <td>{a.ticks} / {a.holds} / {a.posts}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={9} style={{ color: "var(--fg-mute)" }}>No accounts in this group.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
