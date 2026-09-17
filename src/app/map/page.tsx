import { getSession } from "@/lib/auth";
import { getGraphSlice } from "@/lib/graph";
import { getPosition } from "@/lib/holdings";
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
  const slice = await getGraphSlice(session?.sub);
  const position = session ? await getPosition(session.sub) : null;

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        {slice.nodes.length === 0 ? (
          <div style={{ padding: "80px 0" }}>
            <h1 className="serif" style={{ fontSize: 40 }}>The map is empty</h1>
            <p style={{ color: "var(--fg-dim)", marginTop: 12 }}>
              Run <code>npm run db:seed</code> to import The List into the knowledge graph, or add
              nodes in the {session?.role === "ADMIN" ? (
                <Link href="/admin" style={{ color: "var(--amber)", textDecoration: "underline" }}>admin console</Link>
              ) : "admin console"}.
            </p>
          </div>
        ) : (
          <MapView
            slice={slice}
            position={position}
            isAuthed={!!session}
            initialView={view === "list" ? "list" : "map"}
          />
        )}
      </div>
    </>
  );
}
