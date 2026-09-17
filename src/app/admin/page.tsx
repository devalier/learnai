import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import TopBar from "@/components/TopBar";
import AdminConsole from "@/components/AdminConsole";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/login?next=/admin");
  }
  const session = await getSession();

  const courses = await prisma.course.findMany({
    orderBy: { order: "asc" },
    include: {
      sections: {
        orderBy: { order: "asc" },
        include: {
          modules: {
            orderBy: { order: "asc" },
            include: { resources: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });

  const studentCount = await prisma.user.count({ where: { role: "STUDENT" } });

  const [regions, nodes, edges] = await Promise.all([
    prisma.region.findMany({ orderBy: { order: "asc" } }),
    prisma.node.findMany({
      orderBy: [{ regionId: "asc" }, { order: "asc" }],
      include: { references: { orderBy: { order: "asc" } } },
    }),
    prisma.edge.findMany({
      orderBy: { kind: "asc" },
      include: { from: { select: { title: true } }, to: { select: { title: true } } },
    }),
  ]);
  const graph = { regions, nodes, edges };

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <AdminConsole
          courses={JSON.parse(JSON.stringify(courses))}
          studentCount={studentCount}
          graph={JSON.parse(JSON.stringify(graph))}
        />
      </div>
    </>
  );
}
