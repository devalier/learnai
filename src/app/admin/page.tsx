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

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <AdminConsole courses={JSON.parse(JSON.stringify(courses))} studentCount={studentCount} />
      </div>
    </>
  );
}
