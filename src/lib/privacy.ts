import { prisma } from "./db";
import { POLICY_VERSION } from "./legal";
import { nodePoints } from "./points";

/**
 * Privacy operations: social opt-in/out, data export, account deletion.
 *
 * "Social data" is everything the user created in, or that exists only because
 * of, the social features: claims they opened and their positions on claims.
 * Holdings come from The List ticks, which are not social, so they survive an
 * opt-out. Social data is deleted, never anonymised.
 */

/** Delete a user's social data inside an existing transaction client. */
async function deleteSocialDataTx(
  tx: Pick<
    typeof prisma,
    | "claim" | "claimPosition" | "question" | "answer" | "vote" | "answerReview" | "holding"
    | "quiz" | "quizAttempt" | "quizRating" | "quizQuestionReview" | "stake" | "expansion" | "report" | "resourceVote"
  >,
  userId: string
) {
  // Reports they filed and ratings they gave. (Reports about their posts go with the posts.)
  await tx.report.deleteMany({ where: { reporterId: userId } });
  await tx.resourceVote.deleteMany({ where: { userId } });
  // Suggestions to extend the graph: the record linking them to the user goes.
  // A node an AI-validated suggestion already published is shared graph content,
  // not the user's personal data, and stays (it carries no link back to them).
  await tx.expansion.deleteMany({ where: { userId } });
  // Stakes (expert standing) go first; the holdings under them are deleted below.
  await tx.stake.deleteMany({ where: { userId } });
  // Quizzes: ratings, challenges and attempts they made, then quizzes they wrote
  // (which takes everyone's attempts and ratings on those quizzes with them).
  await tx.quizRating.deleteMany({ where: { userId } });
  await tx.quizQuestionReview.deleteMany({ where: { userId } });
  await tx.quizAttempt.deleteMany({ where: { userId } });
  await tx.quiz.deleteMany({ where: { authorId: userId } });
  // A node thinned by failing a quiz goes back to held (only tick-earned holds
  // survive this function; answer-earned ones are deleted below).
  await tx.holding.updateMany({ where: { userId, thinCause: "quiz" }, data: { state: "HELD", thinCause: "" } });
  // Q&A: votes and challenges they made, then answers and questions they wrote.
  // Deleting a question also deletes the answers and votes others left on it.
  await tx.vote.deleteMany({ where: { userId } });
  await tx.answerReview.deleteMany({ where: { userId } });
  await tx.answer.deleteMany({ where: { authorId: userId } });
  await tx.question.deleteMany({ where: { authorId: userId } });
  // Holdings earned by answering are social data. Holdings from ticks are
  // provisional and are not touched.
  await tx.holding.deleteMany({ where: { userId, provisional: false } });
  // Their stances on other people's claims.
  await tx.claimPosition.deleteMany({ where: { userId } });
  // Claims they opened. Claim.openedBy is SetNull, which would anonymise
  // rather than delete, so this must be explicit. Others' stances on these
  // claims go with them (cascade): the proposition was the user's.
  await tx.claim.deleteMany({ where: { openedById: userId } });
}

export async function optIn(userId: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { presenceOptIn: true, ageConfirmedAt: now, termsAcceptedAt: now, termsVersion: POLICY_VERSION },
    }),
    prisma.consentRecord.create({
      data: { userId, purpose: "SOCIAL", granted: true, policyVersion: POLICY_VERSION },
    }),
  ]);
}

export async function optOut(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await deleteSocialDataTx(tx, userId);
    await tx.user.update({ where: { id: userId }, data: { presenceOptIn: false } });
    await tx.consentRecord.create({
      data: { userId, purpose: "SOCIAL", granted: false, policyVersion: POLICY_VERSION },
    });
  });
}

/** Permanently delete the account and every row that belongs to it. */
export async function deleteAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await deleteSocialDataTx(tx, userId);
    // Cascades: progress, holdings, claim positions, consent records.
    await tx.user.delete({ where: { id: userId } });
  });
}

export async function isSocialOptedIn(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { presenceOptIn: true } });
  return !!u?.presenceOptIn;
}

/** Everything we hold about the user, as plain JSON (GDPR Art. 15 and 20). */
export async function exportUserData(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, name: true, role: true, presenceOptIn: true,
      ageConfirmedAt: true, termsAcceptedAt: true, termsVersion: true, createdAt: true,
      lastLoginAt: true, lastSeenAt: true, loginCount: true,
      progress: { select: { moduleId: true, resourceId: true, completed: true, updatedAt: true } },
      holdings: {
        select: {
          state: true, provisional: true, establishedAt: true, lastTouchedAt: true, thinCause: true,
          node: { select: { slug: true, title: true } },
        },
      },
      claimsOpened: { select: { id: true, text: true, createdAt: true, node: { select: { slug: true } } } },
      claimPositions: {
        select: { stance: true, statement: true, createdAt: true, claim: { select: { id: true, text: true } } },
      },
      consents: { select: { purpose: true, granted: true, policyVersion: true, createdAt: true } },
      questions: { select: { text: true, aiAnswer: true, createdAt: true, node: { select: { slug: true } } } },
      answers: {
        select: { text: true, verdict: true, aiReason: true, createdAt: true, question: { select: { text: true } } },
      },
      votes: { select: { value: true, questionId: true, answerId: true, createdAt: true } },
      reviews: { select: { explanation: true, outcome: true, aiReason: true, createdAt: true } },
      quizzes: { select: { focus: true, createdAt: true, node: { select: { slug: true } } } },
      quizAttempts: { select: { correct: true, total: true, passed: true, createdAt: true } },
      quizRatings: { select: { value: true, createdAt: true } },
      quizReviews: { select: { explanation: true, outcome: true, aiReason: true, createdAt: true } },
      stakes: { select: { createdAt: true, node: { select: { slug: true } } } },
      reports: { select: { reason: true, note: true, status: true, createdAt: true } },
      resourceVotes: { select: { value: true, createdAt: true, resource: { select: { title: true } } } },
      expansions: { select: { nodeTitle: true, sourceUrl: true, status: true, reason: true, createdAt: true, parent: { select: { slug: true } } } },
    },
  });
  // Points are internal and never shown in the app, but they are personal data
  // about the user, so a copy of their data includes them.
  const nodeIds = new Set<string>();
  const [hs, ss, qs, as, zs, ts] = await Promise.all([
    prisma.holding.findMany({ where: { userId }, select: { nodeId: true } }),
    prisma.stake.findMany({ where: { userId }, select: { nodeId: true } }),
    prisma.question.findMany({ where: { authorId: userId }, select: { nodeId: true } }),
    prisma.answer.findMany({ where: { authorId: userId }, select: { question: { select: { nodeId: true } } } }),
    prisma.quiz.findMany({ where: { authorId: userId }, select: { nodeId: true } }),
    prisma.quizAttempt.findMany({ where: { userId }, select: { quiz: { select: { nodeId: true } } } }),
  ]);
  for (const x of [...hs, ...ss, ...qs, ...zs]) nodeIds.add(x.nodeId);
  for (const x of as) nodeIds.add(x.question.nodeId);
  for (const x of ts) nodeIds.add(x.quiz.nodeId);
  const nodes = await prisma.node.findMany({ where: { id: { in: [...nodeIds] } }, select: { id: true, slug: true } });
  const points = await Promise.all(nodes.map(async (n) => ({ node: n.slug, points: await nodePoints(userId, n.id) })));
  return { exportedAt: new Date().toISOString(), data: u, internalPoints: points };
}
