import { getSession } from "@/lib/auth";
import { getPrimaryCourse, getUserProgress } from "@/lib/data";
import TopBar from "@/components/TopBar";
import Board, { BoardCourse } from "@/components/Board";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  const course = await getPrimaryCourse();

  let doneModules: string[] = [];
  let doneResources: string[] = [];
  if (session) {
    const p = await getUserProgress(session.sub);
    doneModules = [...p.modules];
    doneResources = [...p.resources];
  }

  return (
    <>
      <TopBar session={session} />
      <div className="shell">
        {!course ? (
          <div style={{ padding: "80px 0" }}>
            <h1 className="serif" style={{ fontSize: 40 }}>No curriculum yet</h1>
            <p style={{ color: "var(--fg-dim)", marginTop: 12 }}>
              An admin needs to add a course. {session?.role === "ADMIN" ? (
                <Link href="/admin" style={{ color: "var(--amber)", textDecoration: "underline" }}>Open the admin console →</Link>
              ) : null}
            </p>
          </div>
        ) : (
          <Board
            course={toBoardCourse(course)}
            initialModules={doneModules}
            initialResources={doneResources}
            isAuthed={!!session}
            firstName={session ? session.name.split(" ")[0] : null}
          />
        )}

        <footer className="footer">
          <span>learnai.devalier · Learn AI for real decisions</span>
          <span>
            {session ? (
              <>Signed in as {session.email}</>
            ) : (
              <><Link href="/login" style={{ color: "var(--fg-dim)" }}>Sign in</Link> · <Link href="/register" style={{ color: "var(--fg-dim)" }}>Create account</Link></>
            )}
          </span>
        </footer>
      </div>
    </>
  );
}

function toBoardCourse(course: NonNullable<Awaited<ReturnType<typeof getPrimaryCourse>>>): BoardCourse {
  return {
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    sections: course.sections.map((s) => ({
      id: s.id,
      kicker: s.kicker,
      title: s.title,
      subtitle: s.subtitle,
      modules: s.modules.map((m) => ({
        id: m.id,
        code: m.code,
        title: m.title,
        topic: m.topic,
        timeSlot: m.timeSlot,
        duration: m.duration,
        summary: m.summary,
        body: m.body,
        resources: m.resources.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          url: r.url,
          author: r.author,
          durationMin: r.durationMin,
          note: r.note,
        })),
      })),
    })),
  };
}
