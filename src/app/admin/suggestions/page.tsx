import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TopBar from "@/components/TopBar";
import SuggestionActions from "@/components/SuggestionActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Suggestions — learnai admin" };

export default async function Suggestions() {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin/suggestions");
  }
  const session = await getSession();
  const rows = await prisma.expansion.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: { parent: { select: { title: true, slug: true } } },
  });
  // PENDING first (enum order is PUBLISHED, PENDING, REJECTED), so sort explicitly.
  const rank = { PENDING: 0, PUBLISHED: 1, REJECTED: 2 } as const;
  rows.sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <div className="settings" style={{ maxWidth: 900 }}>
          <div className="kick" style={{ marginBottom: 6 }}><Link href="/admin">← Admin</Link></div>
          <h1 className="serif" style={{ fontSize: 28 }}>Community suggestions</h1>
          <p className="set-sub">
            New nodes suggested by experts. The AI publishes the clear cases itself; anything it was unsure about waits here.
            Set <code>GRAPH_EXPANSION_AUTO=off</code> to send everything here first.
          </p>
          {rows.length === 0 && <p style={{ color: "var(--fg-mute)", marginTop: 20 }}>No suggestions yet.</p>}
          {rows.map((r) => {
            const rep = (r.report ?? {}) as Record<string, unknown>;
            return (
              <section key={r.id} className="set-card">
                <h2>
                  {r.nodeTitle} <span className="qa-tag">under {r.parent.title}</span>{" "}
                  <span className={`qa-verdict ${r.status === "PUBLISHED" ? "v-correct" : r.status === "REJECTED" ? "v-incorrect" : "v-unsure"}`}>
                    {r.status.toLowerCase()}{r.decidedBy ? ` by ${r.decidedBy === "AI" ? "AI" : "admin"}` : ""}
                  </span>
                </h2>
                <p style={{ margin: "6px 0" }}>
                  <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{r.sourceUrl}</a>
                </p>
                {r.reason && <p>{r.reason}</p>}
                <p className="qa-meta">
                  {["freeAccess", "extension", "unique"].map((k) => (
                    <span key={k}>{k}: <b>{String(rep[k] ?? "n/a")}</b></span>
                  ))}
                </p>
                <SuggestionActions id={r.id} status={r.status} hasDraft={!!r.draft} />
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
