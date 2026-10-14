import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { AiUnavailableError, aiValidateExpansion, type DraftNode, type ExpansionVerdict } from "./ai";
import { QaError, nodeContext } from "./qa";
import { checkSourceUrl, fetchPublicPage, isSourceFetchError, type FetchedPage } from "./safefetch";
import { successTotal, successes } from "./points";

/**
 * Graph expansion. Only someone who has staked a node can suggest a new node
 * next to it, by giving a name and a free source. The suggestion is accepted only
 * if all of these hold:
 *   - the contributor is qualified: they hold a stake on the parent node (which
 *     already requires proven successes on it). Checked by code, not by the AI.
 *   - the node does not already exist (checked by code on name, then by the AI on meaning)
 *   - the source is reachable and free to read (fetched safely, then judged by the AI)
 *   - the node is a correct semantic extension of the graph from the staked node (AI)
 * All checks YES: published automatically (unless GRAPH_EXPANSION_AUTO=off, which
 * sends everything to the admin queue). Any NO: rejected with the reason. Any
 * UNSURE: waits for an admin.
 */

const DAY = 24 * 60 * 60 * 1000;
export const DAILY_LIMIT = 3;

export type Deps = { fetchPage: (url: string) => Promise<FetchedPage> };
const realDeps: Deps = { fetchPage: (u) => fetchPublicPage(u) };

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);

type Report = Record<string, unknown>;
export type Outcome = { status: "PUBLISHED" | "PENDING" | "REJECTED"; reason: string; nodeSlug?: string };

const autoPublish = () => process.env.GRAPH_EXPANSION_AUTO !== "off";

function validDraft(d: DraftNode): boolean {
  return d.title.length >= 2 && !!d.summary && !!d.whatItMeans && !!d.commonlyWrong && !!d.howToDefend;
}

/** Create the node, its edge to the parent, and its source. Throws QaError(409) if the name is taken. */
async function publishDraft(parentNodeId: string, draft: DraftNode, sourceUrl: string, sourceTitle: string) {
  const slug = slugify(draft.title);
  if (slug.length < 2) throw new QaError(400, "BAD_TITLE", "That name cannot be used.");
  try {
    return await prisma.$transaction(async (tx) => {
      const [parent, last] = await Promise.all([
        tx.node.findUniqueOrThrow({ where: { id: parentNodeId }, select: { id: true, regionId: true, x: true, y: true } }),
        tx.node.aggregate({ _max: { order: true } }),
      ]);
      const node = await tx.node.create({
        data: {
          slug, title: draft.title, summary: draft.summary, whatItMeans: draft.whatItMeans,
          commonlyWrong: draft.commonlyWrong, howToDefend: draft.howToDefend, kind: draft.kind,
          regionId: parent.regionId, x: parent.x + (Math.random() - 0.5) * 140, y: parent.y + (Math.random() - 0.5) * 140,
          order: (last._max.order ?? 0) + 1, origin: "COMMUNITY",
        },
        select: { id: true, slug: true },
      });
      await tx.edge.create({ data: { fromId: parent.id, toId: node.id, kind: draft.relation } });
      await tx.communitySource.create({ data: { nodeId: node.id, url: sourceUrl, title: sourceTitle.slice(0, 200) } });
      return node;
    });
  } catch (e) {
    if ((e as { code?: string })?.code === "P2002") throw new QaError(409, "EXISTS", "A node with that name already exists.");
    throw e;
  }
}

export async function submitExpansion(
  userId: string,
  slug: string,
  input: { nodeTitle: unknown; sourceUrl: unknown },
  deps: Deps = realDeps
): Promise<Outcome> {
  const parent = await prisma.node.findUnique({ where: { slug }, select: { id: true, retiredAt: true } });
  if (!parent || parent.retiredAt) throw new QaError(404, "NOT_FOUND", "Node not found.");

  // Qualification: only a staker of this node may extend the graph from it.
  const stake = await prisma.stake.findUnique({ where: { userId_nodeId: { userId, nodeId: parent.id } }, select: { id: true } });
  if (!stake) throw new QaError(403, "NOT_STAKED", "Only people who have staked this node can suggest new nodes from it.");

  const nodeTitle = typeof input.nodeTitle === "string" ? input.nodeTitle.trim().replace(/\s+/g, " ") : "";
  if (nodeTitle.length < 2 || nodeTitle.length > 60) throw new QaError(400, "BAD_TITLE", "The node name must be 2 to 60 characters.");
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .,&'+\-]*$/u.test(nodeTitle)) throw new QaError(400, "BAD_TITLE", "The node name has characters that are not allowed.");
  const newSlug = slugify(nodeTitle);
  if (newSlug.length < 2) throw new QaError(400, "BAD_TITLE", "That name cannot be used.");
  let url: URL;
  try {
    url = checkSourceUrl(typeof input.sourceUrl === "string" ? input.sourceUrl.trim().slice(0, 500) : "");
  } catch (e) {
    throw new QaError(400, "BAD_URL", (e as Error).message);
  }

  const made = await prisma.expansion.count({ where: { userId, createdAt: { gte: new Date(Date.now() - DAY) } } });
  if (made >= DAILY_LIMIT) throw new QaError(429, "RATE_LIMITED", "You can make 3 suggestions a day. Please try again tomorrow.");

  const record = async (status: Outcome["status"], reason: string, extra: Partial<Prisma.ExpansionUncheckedCreateInput> = {}) => {
    await prisma.expansion.create({
      data: {
        userId, parentNodeId: parent.id, sourceUrl: url.toString(), nodeTitle, status, reason,
        decidedBy: status === "PENDING" ? "" : "AI", decidedAt: status === "PENDING" ? null : new Date(), ...extra,
      },
    });
    return { status, reason } as Outcome;
  };

  // 1. Does it already exist? Name checked here; meaning is checked by the AI below.
  const clash = await prisma.node.findFirst({
    where: { OR: [{ slug: newSlug }, { title: { equals: nodeTitle, mode: "insensitive" } }] },
    select: { id: true },
  });
  if (clash) return record("REJECTED", "A node with that name already exists.");
  const waiting = await prisma.expansion.findFirst({ where: { status: "PENDING", nodeTitle: { equals: nodeTitle, mode: "insensitive" } }, select: { id: true } });
  if (waiting) throw new QaError(409, "ALREADY_PENDING", "A suggestion with that name is already waiting for review.");

  // 2. Is the source reachable and free to read? (fetched with SSRF protection)
  let page: FetchedPage;
  try {
    page = await deps.fetchPage(url.toString());
  } catch (e) {
    if (isSourceFetchError(e)) return record("REJECTED", `The source could not be checked: ${e.message}`);
    throw e;
  }
  if (page.status === 401 || page.status === 402) return record("REJECTED", "The source needs payment or a login, so it is not free.");
  if (page.status === 404 || page.status === 410) return record("REJECTED", "The link is broken (page not found).");
  if (page.status < 200 || page.status >= 300)
    return record("REJECTED", `The source did not respond normally (HTTP ${page.status}). Try again later or use another source.`);

  // 3. The AI judges free access, extension and uniqueness, and drafts the node.
  const [existing, ctx, ok] = await Promise.all([
    prisma.node.findMany({ select: { title: true } }),
    nodeContext(parent.id),
    successes(userId, parent.id),
  ]);
  let v: ExpansionVerdict;
  try {
    v = await aiValidateExpansion(ctx, existing.map((n) => n.title), nodeTitle, page);
  } catch (e) {
    if (e instanceof AiUnavailableError) throw new QaError(503, "AI_UNAVAILABLE", "The AI could not check your suggestion right now. Try again later.");
    throw e;
  }
  const report: Report = {
    qualified: { staked: true, successes: successTotal(ok) },
    freeAccess: v.freeAccess, extension: v.extension, unique: v.unique,
    reasons: v.reasons, fetch: { status: page.status, finalUrl: page.finalUrl, contentType: page.contentType, title: page.title },
  };
  const extra = { report: report as Prisma.InputJsonValue, draft: v.node as unknown as Prisma.InputJsonValue };

  const no = (["freeAccess", "extension", "unique"] as const).filter((k) => v[k] === "NO");
  if (no.length) {
    const why = no.map((k) => ({ freeAccess: "the source is not free to access", extension: "it is not a correct extension from this node", unique: "a node like it already exists" })[k]);
    return record("REJECTED", `Not accepted: ${why.join("; ")}.${v.reasons ? " " + v.reasons : ""}`, extra);
  }
  const allYes = v.freeAccess === "YES" && v.extension === "YES" && v.unique === "YES";
  if (allYes && !validDraft(v.node)) return record("REJECTED", "The AI could not write a usable node from that source. Please try again or use another source.", extra);
  if (allYes && autoPublish()) {
    let node;
    try {
      node = await publishDraft(parent.id, v.node, url.toString(), page.title);
    } catch (e) {
      if (e instanceof QaError && e.code === "EXISTS") return record("REJECTED", "A node with that name already exists.", extra);
      throw e;
    }
    await prisma.expansion.create({
      data: {
        userId, parentNodeId: parent.id, sourceUrl: url.toString(), nodeTitle, status: "PUBLISHED", decidedBy: "AI",
        decidedAt: new Date(), reason: v.reasons, createdNodeId: node.id, ...extra,
      },
    });
    return { status: "PUBLISHED", reason: v.reasons, nodeSlug: node.slug };
  }
  // Unsure about something, or automatic publishing is switched off: an admin decides.
  return record(
    "PENDING",
    allYes ? "Passed the checks and is waiting for an admin to approve it." : `The AI was not sure about everything, so an admin will review it.${v.reasons ? " " + v.reasons : ""}`,
    extra
  );
}

export async function listMine(userId: string, slug: string) {
  const parent = await prisma.node.findUnique({ where: { slug }, select: { id: true } });
  if (!parent) return null;
  const rows = await prisma.expansion.findMany({
    where: { userId, parentNodeId: parent.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, nodeTitle: true, sourceUrl: true, status: true, reason: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function adminDecide(id: string, action: "approve" | "reject" | "retire") {
  const e = await prisma.expansion.findUnique({ where: { id } });
  if (!e) throw new QaError(404, "NOT_FOUND", "Suggestion not found.");
  if (action === "retire") {
    if (e.status !== "PUBLISHED" || !e.createdNodeId) throw new QaError(409, "NOT_PUBLISHED", "Only a published suggestion can be retired.");
    await prisma.node.update({ where: { id: e.createdNodeId }, data: { retiredAt: new Date() } });
    return { status: "PUBLISHED" as const, retired: true };
  }
  if (e.status !== "PENDING") throw new QaError(409, "NOT_PENDING", "That suggestion has already been decided.");
  if (action === "reject") {
    await prisma.expansion.update({ where: { id }, data: { status: "REJECTED", decidedBy: "ADMIN", decidedAt: new Date(), reason: "Rejected by an admin." } });
    return { status: "REJECTED" as const };
  }
  const draft = e.draft as unknown as DraftNode | null;
  if (!draft || !validDraft(draft)) throw new QaError(409, "NO_DRAFT", "There is no usable draft to publish. Reject it instead.");
  const report = (e.report ?? {}) as { fetch?: { title?: string } };
  try {
    const node = await publishDraft(e.parentNodeId, draft, e.sourceUrl, report.fetch?.title || new URL(e.sourceUrl).hostname);
    await prisma.expansion.update({ where: { id }, data: { status: "PUBLISHED", decidedBy: "ADMIN", decidedAt: new Date(), createdNodeId: node.id, reason: "Approved by an admin." } });
    return { status: "PUBLISHED" as const, nodeSlug: node.slug };
  } catch (err) {
    if (err instanceof QaError && err.code === "EXISTS") {
      await prisma.expansion.update({ where: { id }, data: { status: "REJECTED", decidedBy: "ADMIN", decidedAt: new Date(), reason: "A node with that name now exists." } });
    }
    throw err;
  }
}
