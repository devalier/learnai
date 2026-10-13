import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TopBar from "@/components/TopBar";
import SettingsPanel from "@/components/SettingsPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — learnai" };

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true, email: true, presenceOptIn: true },
  });
  if (!user) redirect("/login");
  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        <SettingsPanel name={user.name} email={user.email} socialOn={user.presenceOptIn} />
      </div>
    </>
  );
}
