/**
 * Scenario tests for the content sync (src/lib/contentsync.ts) against a real database.
 *
 *   DATABASE_URL=postgresql://.../learnai_test CONTENT_TEST_RESET=1 npm run test:content
 *
 * It WIPES the content tables, so it refuses to run unless the database name ends in
 * "_test" and CONTENT_TEST_RESET=1 is set. The migrations must already be applied.
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { adoptionNeeded, syncContent, type Desired } from "../src/lib/contentsync";
import { writeTombstone } from "../src/lib/contentkeys";
import { getPrimaryCourse } from "../src/lib/data";

const url = process.env.DATABASE_URL ?? "";
if (!/_test(\?|$)/.test(new URL(url).pathname) || process.env.CONTENT_TEST_RESET !== "1") {
  console.error("Refusing to run: DATABASE_URL must name a database ending in _test, and CONTENT_TEST_RESET=1 must be set.");
  process.exit(2);
}

const base = (): Desired => ({
  course: { slug: "c", title: "Course", subtitle: "sub", description: "desc", order: 0 },
  sections: [
    {
      code: "s1", kicker: "k", title: "Section", subtitle: "",
      modules: [
        {
          code: "m1", title: "Module one", summary: "first summary", body: "first body",
          resources: [
            { type: "VIDEO", title: "Video A", url: "https://www.youtube.com/watch?v=AAAAAAAAAAA" },
            { type: "EXERCISE", title: "Exercise E1" },
          ],
        },
        { code: "m2", title: "Module two", summary: "two", resources: [] },
      ],
    },
  ],
  regions: [{ slug: "r1", name: "Region", blurb: "b", labelX: 1, labelY: 2 }],
  nodes: [
    { slug: "n1", title: "Node one", summary: "s", means: "m", wrong: "w", defend: "d", kind: "CONCEPT", region: "r1", x: 1, y: 1 },
    { slug: "n2", title: "Node two", summary: "s", means: "m", wrong: "w", defend: "d", kind: "CONCEPT", region: "r1", x: 2, y: 2 },
  ],
  edges: [["n1", "n2", "ADJACENT"]],
  coverage: [["https://www.youtube.com/watch?v=AAAAAAAAAAA", "n1", "DEFINES", "note", 0.9]],
});

const sync = (d: Desired) => prisma.$transaction((tx) => syncContent(tx, d), { timeout: 60_000 });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
let passed = 0;
const step = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n`, e); process.exit(1); }
};
const changed = (r: { count: Record<string, number> }) =>
  Object.entries(r.count).filter(([k, v]) => v > 0 && /\.(created|updated|retired|deleted|detached)$/.test(k) && !k.startsWith("coverage"));

async function wipe() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Coverage","Holding","Progress","ResourceVote","Resource","Module","Section","Course","Edge","Node","Region","ContentMapping","ContentConflict","User" RESTART IDENTITY CASCADE'
  );
}

async function main() {
  await wipe();
  const D = base();

  await step("fresh database: everything created as SEED with a snapshot", async () => {
    const r = await sync(D);
    assert.equal(r.count["module.created"], 2);
    assert.equal(r.count["node.created"], 2);
    assert.equal(await prisma.module.count({ where: { origin: "SEED", seedSnapshot: { not: undefined } } }), 2);
    assert.equal(await prisma.resource.count({ where: { origin: "SEED" } }), 2);
    assert.equal(await prisma.coverage.count({ where: { source: "SEED" } }), 1);
  });

  await step("running the same seed again changes nothing", async () => {
    const r = await sync(D);
    assert.deepEqual(changed(r), []);
    assert.equal(r.conflicts, 0);
  });

  await step("an admin edit survives an unchanged seed", async () => {
    await prisma.module.update({ where: { id: (await prisma.module.findFirstOrThrow({ where: { code: "m1" } })).id }, data: { summary: "ADMIN summary" } });
    await prisma.node.update({ where: { slug: "n1" }, data: { title: "ADMIN node title" } });
    const r = await sync(D);
    assert.equal(r.conflicts, 0);
    assert.equal((await prisma.module.findFirstOrThrow({ where: { code: "m1" } })).summary, "ADMIN summary");
    assert.equal((await prisma.node.findUniqueOrThrow({ where: { slug: "n1" } })).title, "ADMIN node title");
  });

  await step("PR and admin changing different fields of one row: both kept", async () => {
    const d = clone(D);
    d.sections[0].modules[0].body = "PR body";
    await sync(d);
    const m = await prisma.module.findFirstOrThrow({ where: { code: "m1" } });
    assert.equal(m.body, "PR body");
    assert.equal(m.summary, "ADMIN summary");
  });

  await step("PR and admin changing the same field: admin kept, conflict recorded", async () => {
    const d = clone(D);
    d.sections[0].modules[0].body = "PR body";
    d.sections[0].modules[0].summary = "PR summary";
    const r = await sync(d);
    assert.equal(r.conflicts, 1);
    assert.equal((await prisma.module.findFirstOrThrow({ where: { code: "m1" } })).summary, "ADMIN summary");
    const c = await prisma.contentConflict.findFirstOrThrow({ where: { kind: "module", key: "m1", field: "summary" } });
    assert.equal(c.status, "OPEN");
    assert.equal(c.seedValue, "PR summary");
    assert.equal(c.adminValue, "ADMIN summary");
    await sync(d); // repeated runs do not pile up rows
    assert.equal(await prisma.contentConflict.count(), 1);
  });

  await step("a conflict closes itself once the admin value matches the seed", async () => {
    const d = clone(D);
    d.sections[0].modules[0].body = "PR body";
    d.sections[0].modules[0].summary = "PR summary";
    await prisma.module.update({ where: { id: (await prisma.module.findFirstOrThrow({ where: { code: "m1" } })).id }, data: { summary: "PR summary" } });
    await sync(d);
    assert.equal((await prisma.contentConflict.findFirstOrThrow()).status, "KEPT_ADMIN");
    D.sections[0].modules[0].body = "PR body";
    D.sections[0].modules[0].summary = "PR summary";
  });

  await step("an untouched row takes the PR's change", async () => {
    const d = clone(D);
    d.nodes[1].title = "Node two renamed";
    await sync(d);
    assert.equal((await prisma.node.findUniqueOrThrow({ where: { slug: "n2" } })).title, "Node two renamed");
    D.nodes[1].title = "Node two renamed";
  });

  const m1 = await prisma.module.findFirstOrThrow({ where: { code: "m1" } });
  await step("admin-made rows are never touched or deleted by the seed", async () => {
    const adminMod = await prisma.module.create({ data: { sectionId: m1.sectionId, code: "ADM", title: "Admin module" } });
    await prisma.resource.create({ data: { moduleId: m1.id, type: "VIDEO", title: "Admin video", url: "https://example.com/x" } });
    const adminNode = await prisma.node.create({ data: { slug: "adm-node", title: "Admin node", origin: "ADMIN" } });
    const n1 = await prisma.node.findUniqueOrThrow({ where: { slug: "n1" } });
    await prisma.edge.create({ data: { fromId: n1.id, toId: adminNode.id, kind: "ADJACENT" } });
    await prisma.region.create({ data: { slug: "adm-region", name: "Admin region" } });
    const res = (await prisma.resource.findFirstOrThrow({ where: { title: "Video A" } }));
    await prisma.coverage.create({ data: { nodeId: adminNode.id, resourceId: res.id, depth: "DEFINES", evidence: "by hand", source: "HUMAN" } });
    await sync(D);
    assert.ok(await prisma.module.findUnique({ where: { id: adminMod.id } }));
    assert.equal(await prisma.resource.count({ where: { title: "Admin video" } }), 1);
    assert.equal((await prisma.node.findUniqueOrThrow({ where: { slug: "adm-node" } })).retiredAt, null);
    assert.equal(await prisma.edge.count({ where: { toId: adminNode.id } }), 1);
    assert.ok(await prisma.region.findUnique({ where: { slug: "adm-region" } }));
    assert.equal(await prisma.coverage.count({ where: { source: "HUMAN" } }), 1);
  });

  await step("a PR that drops an untouched module with no progress deletes it", async () => {
    const d = clone(D);
    d.sections[0].modules = d.sections[0].modules.filter((m) => m.code !== "m2");
    const r = await sync(d);
    assert.equal(r.count["module.deleted"], 1);
    assert.equal(await prisma.module.count({ where: { code: "m2" } }), 0);
    // restore for later steps
    await sync(D);
  });

  await step("a PR that drops a module an admin edited detaches it instead of deleting", async () => {
    const m2 = await prisma.module.findFirstOrThrow({ where: { code: "m2" } });
    await prisma.module.update({ where: { id: m2.id }, data: { title: "Admin retitled" } });
    const d = clone(D);
    d.sections[0].modules = d.sections[0].modules.filter((m) => m.code !== "m2");
    const r = await sync(d);
    assert.equal(r.count["module.detached"], 1);
    const kept = await prisma.module.findFirstOrThrow({ where: { code: "m2" } });
    assert.equal(kept.origin, "ADMIN");
    assert.equal(kept.title, "Admin retitled");
    await prisma.module.delete({ where: { id: m2.id } });
    await sync(D);
  });

  await step("a PR that drops a module with learner progress retires it and keeps the ticks", async () => {
    const user = await prisma.user.create({ data: { email: "t@x.io", name: "T", passwordHash: "x" } });
    const m = await prisma.module.findFirstOrThrow({ where: { code: "m2" } });
    await prisma.progress.create({ data: { userId: user.id, moduleId: m.id } });
    const d = clone(D);
    d.sections[0].modules = d.sections[0].modules.filter((x) => x.code !== "m2");
    const r = await sync(d);
    assert.equal(r.count["module.retired"], 1);
    const after = await prisma.module.findUniqueOrThrow({ where: { id: m.id } });
    assert.ok(after.retiredAt);
    assert.equal(await prisma.progress.count({ where: { moduleId: m.id } }), 1);
    const list = await getPrimaryCourse();
    assert.ok(!list!.sections.flatMap((s) => s.modules).some((x) => x.code === "m2"), "retired module hidden from the List");
    const again = await sync(d);
    assert.deepEqual(changed(again), [], "retiring is stable");
    await sync(D);
    assert.equal((await prisma.module.findUniqueOrThrow({ where: { id: m.id } })).retiredAt, null, "re-adding un-retires it");
    assert.equal(await prisma.progress.count({ where: { moduleId: m.id } }), 1);
  });

  await step("a dropped resource with a tick is retired, not deleted", async () => {
    const user = await prisma.user.findFirstOrThrow();
    const vid = await prisma.resource.findFirstOrThrow({ where: { title: "Video A" } });
    await prisma.progress.create({ data: { userId: user.id, resourceId: vid.id } });
    const d = clone(D);
    d.sections[0].modules[0].resources = d.sections[0].modules[0].resources.filter((r) => r.title !== "Video A");
    d.coverage = [];
    const r = await sync(d);
    assert.equal(r.count["resource.retired"], 1);
    assert.ok((await prisma.resource.findUniqueOrThrow({ where: { id: vid.id } })).retiredAt);
    assert.equal(await prisma.progress.count({ where: { resourceId: vid.id } }), 1);
    assert.equal(await prisma.resource.count({ where: { title: "Admin video" } }), 1);
    await sync(D);
    assert.equal((await prisma.resource.findUniqueOrThrow({ where: { id: vid.id } })).retiredAt, null);
  });

  await step("what an admin deleted on purpose is not recreated", async () => {
    const n2 = await prisma.node.findUniqueOrThrow({ where: { slug: "n2" } });
    await writeTombstone("node", "n2");
    await prisma.node.delete({ where: { id: n2.id } });
    await writeTombstone("module", "m2");
    await prisma.module.deleteMany({ where: { code: "m2" } });
    const r = await sync(D);
    assert.equal(await prisma.node.count({ where: { slug: "n2" } }), 0);
    assert.equal(await prisma.module.count({ where: { code: "m2" } }), 0);
    assert.ok(r.lines.some((l) => l.includes("tombstone")));
  });

  await step("a row that matches a seed key but is not the seed's is protected", async () => {
    const sec = await prisma.section.findFirstOrThrow({ where: { code: "s1" } });
    await prisma.module.create({ data: { sectionId: sec.id, code: "m9", title: "Admin m9" } });
    const d = clone(D);
    d.sections[0].modules.push({ code: "m9", title: "PR m9", resources: [] });
    const r = await sync(d);
    assert.ok(r.protectedKeys.includes("module m9"));
    assert.equal((await prisma.module.findFirstOrThrow({ where: { code: "m9" } })).title, "Admin m9");
    assert.deepEqual(await adoptionNeeded(prisma, d), ["module m9"]);
  });

  await step("a failure part-way leaves the database exactly as it was", async () => {
    await wipe();
    const bad = clone(base());
    bad.edges.push(["n1", "ghost", "ADJACENT"]);
    await assert.rejects(sync(bad));
    assert.equal(await prisma.module.count(), 0);
    assert.equal(await prisma.node.count(), 0);
    assert.equal(await prisma.course.count(), 0);
  });

  console.log(`\n${passed} scenarios passed.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
