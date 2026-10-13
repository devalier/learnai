import { prisma } from "./db";
import { POLICY_VERSION } from "./legal";

/**
 * Privacy operations: social opt-in/out, data export, account deletion.
 *
 * "Social data" is everything the user created in, or that exists only because
 * of, the social features: claims they opened and their positions on claims.
 * Holdings come from The List ticks, which are not social, so they survive an
 * opt-out. Social data is deleted, never anonymised.
 */

/** Delete a user's social data inside an existing transaction client. */
async function deleteSocialDataTx(tx: Pick<typeof prisma, "claim" | "claimPosition">, userId: string) {
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
    },
  });
  return { exportedAt: new Date().toISOString(), data: u };
}
