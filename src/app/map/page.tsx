import { getSession } from "@/lib/auth";
import { isSchemaOutOfDate } from "@/lib/db";
import { getGraphSlice, type GraphSlice } from "@/lib/graph";
import { getPosition } from "@/lib/holdings";
import type { Position } from "@/lib/holdings";
import TopBar from "@/components/TopBar";
import MapView from "@/components/MapView";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const session = await getSession();

  let slice: GraphSlice | null = null;
  let position: Position | null = null;
  let schemaMissing = false;
  try {
    slice = await getGraphSlice(session?.sub);
    position = session ? await getPosition(session.sub) : null;
  } catch (err) {
    // The graph tables are not in the database yet (code deployed ahead of the
    // schema). Explain it instead of failing the whole page with a 500.
    if (!isSchemaOutOfDate(err)) throw err;
    schemaMissing = true;
  }

  const adminLink =
    session?.role === "ADMIN" ? (
      <Link href="/admin" style={{ color: "var(--amber)", textDecoration: "underline" }}>admin console</Link>
    ) : (
      "admin console"
    );

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        {schemaMissing ? (
          <div style={{ padding: "80px 0" }}>
            <h1 className="serif" style={{ fontSize: 40 }}>The map isn&rsquo;t ready yet</h1>
            <p style={{ color: "var(--fg-dim)", marginTop: 12 }}>
              The knowledge graph tables are missing from the database. An admin needs to apply the
              schema on the server (<code>npm run db:push</code>) and then load the graph
              (<code>npm run db:seed</code>). The rest of the site is unaffected.
            </p>
          </div>
        ) : slice!.nodes.length === 0 ? (
          <div style={{ padding: "80px 0" }}>
            <h1 className="serif" style={{ fontSize: 40 }}>The map is empty</h1>
            <p style={{ color: "var(--fg-dim)", marginTop: 12 }}>
              Run <code>npm run db:seed</code> to import The List into the knowledge graph, or add
              nodes in the {adminLink}.
            </p>
          </div>
        ) : (
          <MapView
            slice={slice!}
            position={position}
            isAuthed={!!session}
            initialView={view === "list" ? "list" : "map"}
          />
        )}
      </div>
    </>
  );
}
