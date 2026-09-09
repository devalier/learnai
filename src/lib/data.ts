import { prisma } from "./db";

export async function getPrimaryCourse() {
  const course = await prisma.course.findFirst({
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
  return course;
}

export async function getUserProgress(userId: string) {
  const rows = await prisma.progress.findMany({
    where: { userId, completed: true },
    select: { moduleId: true, resourceId: true },
  });
  return {
    modules: new Set(rows.map((r) => r.moduleId).filter(Boolean) as string[]),
    resources: new Set(rows.map((r) => r.resourceId).filter(Boolean) as string[]),
  };
}

export type CourseWithAll = NonNullable<Awaited<ReturnType<typeof getPrimaryCourse>>>;
