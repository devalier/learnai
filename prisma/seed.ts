import { hashPassword } from "../src/lib/auth";
import { prisma } from "../src/lib/db";
import { recomputeProvisionalHoldings } from "../src/lib/holdings";
import { resourceKey } from "../src/lib/resourcekey";

type R = {
  type: "VIDEO" | "COURSE" | "ARTICLE" | "EXERCISE";
  title: string;
  url?: string;
  author?: string;
  durationMin?: number;
  note?: string;
};

type M = {
  code?: string;
  title: string;
  topic?: string;
  timeSlot?: string;
  duration?: string;
  summary?: string;
  body?: string;
  resources?: R[];
};

type S = { kicker?: string; title: string; subtitle?: string; modules: M[] };

const sections: S[] = [
  {
    kicker: "Before you start · a weekend · ~3 hours · free",
    title: "Get the vocabulary first",
    subtitle:
      "Do this before Day 1, so the first morning goes on judgement, not definitions. If you only have time for one thing, watch the short language-model video.",
    modules: [
      {
        code: "PRE",
        title: "Build your AI vocabulary before you begin",
        topic: "Foundations: what AI actually is",
        duration: "~3 hrs",
        summary:
          "Six short, free videos — from why AI matters to what a model is actually doing. Watch them in order.",
        body: `**Watch order:** the electricity talk → the TED talk → Tina Huang → 3Blue1Brown → the HAI explainer.

**Optional, not required.** The University of Helsinki's *Elements of AI* is a good free, structured course if you want more depth.

**Not used here.** No paid enrolments — the Coursera *AI for Everyone*, the DeepLearning.AI *Generative AI for Everyone*, and paid leader certificates are deliberately left out. Everything in this course is free (YouTube and official public pages).`,
        resources: [
          {
            type: "VIDEO",
            title: "AI is the New Electricity",
            author: "Andrew Ng · Stanford GSB",
            url: "https://www.youtube.com/watch?v=21EiKfQYZXc",
          },
          {
            type: "VIDEO",
            title: "How AI Could Empower Any Business (TED)",
            author: "Andrew Ng · TED",
            url: "https://www.youtube.com/watch?v=reUZRyXxUs4",
          },
          {
            type: "VIDEO",
            title: "AI for Everyone orientation",
            author: "DeepLearning.AI",
            url: "https://www.youtube.com/watch?v=JPcx9qHzzgk",
            durationMin: 8,
          },
          {
            type: "VIDEO",
            title: "Generative AI for Everyone in 25 minutes",
            author: "Tina Huang",
            url: "https://www.youtube.com/watch?v=qpWqrIsaKwo",
            durationMin: 25,
          },
          {
            type: "VIDEO",
            title: "Large Language Models explained briefly",
            author: "3Blue1Brown",
            url: "https://www.youtube.com/watch?v=LPZh9BOjkQs",
            durationMin: 8,
          },
          {
            type: "VIDEO",
            title: "Foundation Models: An Explainer for Non-Experts",
            author: "Stanford HAI",
            url: "https://www.youtube.com/watch?v=kK3NmQT241w",
            durationMin: 2,
          },
          {
            type: "COURSE",
            title: "Elements of AI (optional, not required)",
            author: "University of Helsinki & MinnaLearn",
            url: "https://www.elementsofai.com/",
            note: "A free, structured course if you want more depth than the videos.",
          },
          {
            type: "VIDEO",
            title: "The arrival of AGI (optional)",
            author: "Shane Legg & Hannah Fry · Google DeepMind podcast",
            url: "https://www.youtube.com/watch?v=l3u_FAv33G0",
            durationMin: 48,
            note: "What \"general\" means, from the person who coined the term: minimal AGI, full AGI, and how you would test for either.",
          },
        ],
      },
    ],
  },
  {
    kicker: "Day 1 · How the technology works",
    title: "Enough mechanism to judge the tools, not just use them",
    subtitle:
      "The videos are short clips, not the lesson — the work is in reading, trying, and questioning. The goal is to stop being a passive audience for demos and be able to test a claim yourself.",
    modules: [
      {
        code: "D1-A",
        title: "What the machine actually does",
        topic: "Foundations: how a language model works",
        timeSlot: "~90 min",
        duration: "90 min",
        summary:
          "Learn the mechanism in plain terms, then red-pen three prepared answers about a one-page memo and mark what is wrong.",
        body: `**Learn these first, then treat the videos as clips:**

- **Token ≠ thought** — a token is a chunk of text
- **Next-token prediction is the whole trick**
- **Training vs inference** — training is the one-off, expensive part that sets the weights; inference is what you pay for on every query
- **Temperature** means the same prompt is not a laboratory method — you will not get the same answer twice
- **Hallucination** is unconstrained pattern completion — the model fills a plausible pattern with no obligation to be grounded

**Exercise (20 min).** Read a one-page memo, then three answers to: what is the claim, what is the evidence, what is missing? Mark the errors in red. Everything you need is in the worksheet.

**The point:** you can only judge output on a page you know cold. It shows how fluent answers go wrong in small ways, and that answers disagree. Marking errors against fixed criteria is a small eval. The worksheet under Resources walks you through it, with an answer key; no outside service is needed.`,
        resources: [
          {
            type: "VIDEO",
            title: "Transformers, the tech behind LLMs",
            author: "3Blue1Brown",
            url: "https://www.youtube.com/watch?v=wjZofJX0v4M",
            durationMin: 27,
          },
          {
            type: "VIDEO",
            title: "Intro to Large Language Models",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
          },
          {
            type: "EXERCISE",
            title: "Red-pen three answers: claim / evidence / missing",
            durationMin: 20,
            note: "Read a short memo and three prepared answers. Mark what is wrong in red.",
          },
        ],
      },
      {
        code: "D1-B",
        title: "Prompt, RAG, fine-tune, or a bigger model",
        topic: "Models and the four levers",
        timeSlot: "~60 min",
        duration: "60 min",
        summary:
          "Four levers. Vendors routinely conflate them — learn when each is the right tool and when it is theatre.",
        body: `**Four levers — vendors conflate them:**

| Lever | What changes | When it is the right tool | When it is theatre |
| --- | --- | --- | --- |
| Better prompt / more context | nothing in the weights | one-off drafting, interrogation | "proprietary prompt library" as a product |
| RAG | documents retrieved at ask-time | corpus changes; you need citations | junk PDFs in a vector DB with no eval |
| Fine-tune | weights | stable style/format at high volume | "train it on all our opinions" with 40 examples |
| Bigger / newer model | the vendor bill | hard reasoning, messy tools | the default answer to every problem |`,
        resources: [
          {
            type: "VIDEO",
            title: "9 AI Concepts Explained (skip to RAG / agents / fine-tuning)",
            url: "https://www.youtube.com/watch?v=nVnxG10D5W0",
            durationMin: 7,
          },
          {
            type: "VIDEO",
            title: "What is Retrieval-Augmented Generation (RAG)?",
            author: "Marina Danilevsky · IBM Technology",
            url: "https://www.youtube.com/watch?v=T-D1OfcDW1M",
            durationMin: 6,
          },
          {
            type: "VIDEO",
            title: "How to choose between RAG and fine-tuning",
            author: "IBM Technology",
            url: "https://www.youtube.com/watch?v=00Q0G84kq3M",
            durationMin: 9,
          },
        ],
      },
      {
        code: "D1-C",
        title: "Agents, autonomy, and why real processes break demos",
        topic: "Autonomy and decision support",
        timeSlot: "~60 min",
        duration: "60 min",
        summary:
          "An agent is a model allowed to call tools in a loop. It fails on undocumented exceptions, messy output, no stop condition, or when a wrong action is legal.",
        body: `**What an agent is.** A model allowed to call tools in a loop — search, write, click, run code, retrieve.

**Where it fails:**

- the process has undocumented exceptions
- the tool output is messy
- there is no stop condition
- the cost of a wrong action is legal

**Exercise.** Pick one live process. Write down three things: the **unit of work**, the **human fallback**, and **what happens if it is confidently wrong**.`,
        resources: [
          {
            type: "VIDEO",
            title: "Intro to LLMs — tool use (~27 min) & security (~46 min)",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
            note: "Same talk as the morning. The security section covers jailbreaks, prompt injection and data poisoning.",
          },
          {
            type: "EXERCISE",
            title: "Name the unit of work",
            note: "One live process → unit of work / human fallback / cost of a confident error.",
          },
          {
            type: "VIDEO",
            title: "How we build effective agents",
            author: "Barry Zhang · Anthropic · AI Engineer Summit",
            url: "https://www.youtube.com/watch?v=D7_ipDqhtwk",
            durationMin: 15,
            note: "When a workflow beats an agent, and what a task must look like before you hand it autonomy.",
          },
          {
            type: "VIDEO",
            title: "Human-Centered AI: reliable, safe and trustworthy",
            author: "Ben Shneiderman · Imperial College London",
            url: "https://www.youtube.com/watch?v=o5XwczIERvM",
            note: "Human control and automation as two separate axes — you can have high levels of both.",
          },
        ],
      },
      {
        code: "D1-D",
        title: "Risk you can already govern, and the EU rules that apply",
        topic: "Responsible and lawful AI",
        timeSlot: "~60 min",
        duration: "60 min",
        summary:
          "Four risk buckets you already know how to run: confidentiality, integrity of the record, workforce, liability.",
        body: `**Four buckets you already know how to run:**

- **Confidentiality** — does the text leave the building?
- **Integrity of the record** — can a draft become an opinion without a named reviewer?
- **Workforce** — who is deskilled and who is amplified?
- **Liability** — if it speaks, the organisation speaks.

The EU AI Act sets the rules that apply — start from the official overview below.

**Homework.** Tonight, run one real task through a model and bring the raw output plus your edit. No edit means you present the raw output.`,
        resources: [
          {
            type: "ARTICLE",
            title: "EU AI Act — official overview of the regulatory framework",
            author: "European Commission",
            url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
          },
          {
            type: "ARTICLE",
            title: "AI system development: the CNIL's recommendations to comply with the GDPR",
            author: "CNIL (French data protection authority)",
            url: "https://www.cnil.fr/en/ai-system-development-cnils-recommendations-to-comply-gdpr",
            note: "No free video teaches this well; this is the regulator's own guidance, in English.",
          },
        ],
      },
    ],
  },
  {
    kicker: "Day 2 · Turning it into decisions",
    title: "From how it works to where it pays off",
    subtitle:
      "Open by looking again at yesterday's document exercise: the tool was fast and uneven. Both halves of that sentence matter for the decisions that follow.",
    modules: [
      {
        code: "D2-A",
        title: "How value actually appears",
        topic: "Where AI creates value",
        timeSlot: "~90 min",
        duration: "90 min",
        summary:
          "Five workflow shapes. For each: hours saved, failure mode, who owns the clean-up, whether data may leave the tenant. A demo is not a system — an eval set is.",
        body: `Open with last night's homework — the tool is fast and uneven, and both halves matter.

**Five workflow types:**

1. **Draft / rewrite** — minutes, letters, web copy
2. **Interrogate a pack** — a dossier, mandate, contract or vendor deck
3. **Literature / evidence map** — with retrieval, not guesswork
4. **Surveillance assist** — a cluster narrative *after* the pipeline, not instead of it
5. **Meeting / decision support** — the agenda, the open questions, and what is *not* yet decided

**The sentence to leave with:** a demo is not a system. An eval set is.`,
        resources: [
          {
            type: "VIDEO",
            title: "How to Build AI Evals (first ~20 min)",
            author: "Hamel Husain",
            url: "https://www.youtube.com/watch?v=mF4CaijvJos",
            durationMin: 20,
          },
          {
            type: "VIDEO",
            title: "Evaluations, in depth",
            author: "Lenny's Podcast · Husain & Shreya Shankar",
            url: "https://www.youtube.com/watch?v=BsWxPI9UM4c",
          },
          {
            type: "VIDEO",
            title: "Start from the decision, not the model",
            author: "Kuang Xu · Stanford GSB",
            url: "https://www.youtube.com/watch?v=HjRtK0JguBY",
            durationMin: 5,
          },
        ],
      },
      {
        code: "D2-B",
        title: "How to question a vendor, and your own IT",
        topic: "Buying and building",
        timeSlot: "~45 min",
        duration: "45 min",
        summary:
          "A six-question script that fits on one slide. Serious teams answer with numbers; \"transformative\" is the tell.",
        body: `**The six questions.** If they cannot answer these, they are selling a deck:

1. What is the **unit of work**?
2. What is the **eval set** — who labelled it, and what is pass/fail?
3. What is the **human fallback** when it is wrong *and* confident?
4. What is the **cost at 10× volume** — tokens, review hours, rework?
5. What **data leaves the building**, retained how long, and is it trained on?
6. Where did a similar deployment **fail in public**?

Serious teams have numbers. "Transformative" is the tell.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Run the six-question script against a real pitch",
            note: "Take a supplier deck or an internal proposal and answer all six. Score: numbers vs adjectives.",
          },
        ],
      },
      {
        code: "D2-C",
        title: "Five candidate uses for your own unit",
        topic: "Your opportunities",
        timeSlot: "~90 min",
        duration: "90 min",
        summary:
          "Take one workflow and write it up on a single page. Don't pick a winner yet — that is a later decision, made with evidence.",
        body: `For one workflow, write one page:

- The **decision** it supports
- The **data** it needs
- An **eval** — 20 real examples, labelled by a practitioner
- The **owner**
- A **kill criterion** — what result within 30 days means stop
- What **legal / cyber must enable**, not forbid`,
        resources: [
          {
            type: "EXERCISE",
            title: "One page per candidate use",
            note: "Decision · data · eval (20 labelled examples) · owner · kill criterion · what must be enabled.",
          },
        ],
      },
      {
        code: "D2-D",
        title: "Governance as a path, not a wall",
        topic: "Governance",
        timeSlot: "~45 min",
        duration: "45 min",
        summary:
          "Rewrite the rule from \"no, until we understand it\" to \"yes in a sandbox, with an eval, a named reviewer, and a log\".",
        body: `**Rewrite the implicit rule.**

- **Current:** no, until we understand it.
- **Target:** yes in a sandbox — with an eval, a named reviewer, and a log; production only when the eval holds.

A bare "no" with no path is a decision to stay analog.`,
        resources: [],
      },
    ],
  },
  {
    kicker: "After the two days · 30 days of practice",
    title: "The 30-day practice plan",
    subtitle:
      "Two days of learning, thirty days of practice. One real task a day, about twenty minutes, all month — so you learn the habit, not the brand of the week. An AI tool is optional.",
    modules: [
      {
        code: "30D",
        title: "30 days of deliberate practice",
        topic: "Putting it to work",
        duration: "30 days",
        summary:
          "One real task a day, ~20 minutes, all month. An AI tool is optional.",
        body: `One real task a day, about twenty minutes. Use an AI tool only if you already have one and may use it; every task works without.

| Week | Daily task |
| --- | --- |
| 1 | Draft or rewrite something you would have written anyway |
| 2 | Interrogate a document you did not write |
| 3 | Summarise a pack and list what the summary cannot be used for |
| 4 | Challenge an AI output from a colleague or a vendor; write the failure mode |

**Iron rule:** never forward an AI output you have not edited.

**Friday, 20 minutes:** one win, one miss. No slides.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Commit to the 30-day plan",
            note: "One task a day · any tool, or none · never forward an unchecked output · a Friday check-in.",
          },
        ],
      },
    ],
  },
  {
    kicker: "Reference · keep these, don't binge them",
    title: "Core references and optional deep dives",
    subtitle:
      "Watch these once and come back to the clips you need. The deep dives are for anyone on the technical side.",
    modules: [
      {
        code: "SRC-1",
        title: "Core — watch once, reuse the clips",
        topic: "Reference",
        summary: "The references worth returning to whenever you or a colleague needs a refresher.",
        resources: [
          {
            type: "VIDEO",
            title: "Large Language Models explained briefly",
            author: "3Blue1Brown",
            url: "https://www.youtube.com/watch?v=LPZh9BOjkQs",
            durationMin: 8,
          },
          {
            type: "VIDEO",
            title: "Transformers, the tech behind LLMs",
            author: "3Blue1Brown",
            url: "https://www.youtube.com/watch?v=wjZofJX0v4M",
            durationMin: 27,
          },
          {
            type: "VIDEO",
            title: "Intro to Large Language Models",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
          },
          {
            type: "VIDEO",
            title: "State of GPT — pretrain → fine-tune → alignment",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=bZQun8Y4L2A",
          },
          {
            type: "VIDEO",
            title: "LLM Evals: Common Mistakes",
            author: "Hamel Husain",
            url: "https://www.youtube.com/watch?v=GL0XhAj5LPE",
            durationMin: 28,
          },
          {
            type: "VIDEO",
            title: "Foundation Models: An Explainer for Non-Experts",
            author: "Stanford HAI",
            url: "https://www.youtube.com/watch?v=kK3NmQT241w",
            durationMin: 2,
          },
          {
            type: "VIDEO",
            title: "Start from the decision, not the model",
            author: "Kuang Xu · Stanford GSB",
            url: "https://www.youtube.com/watch?v=HjRtK0JguBY",
            durationMin: 5,
          },
          {
            type: "ARTICLE",
            title: "EU AI Act — official overview of the regulatory framework",
            author: "European Commission",
            url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
          },
        ],
      },
      {
        code: "SRC-2",
        title: "Optional deep dive — for the technical side",
        topic: "Reference",
        summary: "Not needed for the decision-maker track. Useful if someone on your team wants to see under the hood.",
        body: `**Follow after the course, not during it:** @karpathy, @AndrewYNg, @HamelHusain.`,
        resources: [
          {
            type: "VIDEO",
            title: "Let's build GPT from scratch",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
          },
          {
            type: "VIDEO",
            title: "Foundation Models workshop (playlist)",
            author: "Stanford HAI",
            url: "https://www.youtube.com/playlist?list=PLYLBSCrrqNXz1RQCVwv7mApexCcn7Bybk",
          },
        ],
      },
    ],
  },
];

const COURSE = {
  slug: "ai-for-decision-makers",
  title: "AI for Decision-Makers",
  subtitle:
    "Learn how AI really works, then apply it to strategy and decisions — two days of grounding, thirty days of practice.",
  description:
    "A practical course for people who make decisions and need to judge AI, not just hear about it. Every resource is free — YouTube and official public pages, with no paid Coursera or DeepLearning.AI enrolments — so the whole programme can be followed at no cost.",
  order: 0,
};

/**
 * Idempotent content sync. Safe to run repeatedly: the course is updated in
 * place (keyed by slug), sections by position, and modules by their stable
 * `code`. Matching modules by code keeps their ids stable, so the Progress
 * rows that reference them — every learner's ticked boxes — survive a re-run.
 * Nothing is deleted unless it was genuinely removed from the curriculum below.
 */
/**
 * Admin bootstrap credentials come from the environment only. There are no
 * defaults: a missing value aborts the seed rather than silently creating an
 * administrator with a predictable credential.
 */
function requiredEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `${key} is not set. Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_NAME in the ` +
        `environment before seeding (see .env.example).`,
    );
  }
  return value;
}

async function main() {
  const email = requiredEnv("ADMIN_EMAIL");
  const password = requiredEnv("ADMIN_PASSWORD");
  const name = requiredEnv("ADMIN_NAME");

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: {
      email,
      name,
      role: "ADMIN",
      passwordHash: await hashPassword(password),
    },
  });
  console.log(`Admin ready: ${email}`);

  const course = await prisma.course.upsert({
    where: { slug: COURSE.slug },
    update: { title: COURSE.title, subtitle: COURSE.subtitle, description: COURSE.description, order: COURSE.order },
    create: COURSE,
  });

  const keptSectionIds: string[] = [];
  const keptModuleCodes: string[] = [];

  for (const [si, s] of sections.entries()) {
    const sectionData = {
      courseId: course.id,
      kicker: s.kicker || "",
      title: s.title,
      subtitle: s.subtitle || "",
      order: si,
    };
    const existingSection = await prisma.section.findFirst({
      where: { courseId: course.id, order: si },
    });
    const section = existingSection
      ? await prisma.section.update({ where: { id: existingSection.id }, data: sectionData })
      : await prisma.section.create({ data: sectionData });
    keptSectionIds.push(section.id);

    for (const [mi, m] of s.modules.entries()) {
      const code = m.code || `S${si}-M${mi}`;
      keptModuleCodes.push(code);
      const moduleData = {
        sectionId: section.id,
        code,
        title: m.title,
        topic: m.topic || "",
        timeSlot: m.timeSlot || "",
        duration: m.duration || "",
        summary: m.summary || "",
        body: m.body || "",
        order: mi,
      };
      // Match by stable code within the course so the module id (and its
      // Progress rows) are preserved across re-runs.
      const existingModule = await prisma.module.findFirst({
        where: { code, section: { courseId: course.id } },
      });
      const mod = existingModule
        ? await prisma.module.update({ where: { id: existingModule.id }, data: moduleData })
        : await prisma.module.create({ data: moduleData });

      const resources = m.resources || [];
      for (const [ri, r] of resources.entries()) {
        const resourceData = {
          moduleId: mod.id,
          type: r.type,
          title: r.title,
          url: r.url || "",
          author: r.author || "",
          durationMin: r.durationMin ?? null,
          note: r.note || "",
          order: ri,
        };
        const existingResource = await prisma.resource.findFirst({
          where: { moduleId: mod.id, order: ri },
        });
        if (existingResource) {
          await prisma.resource.update({ where: { id: existingResource.id }, data: resourceData });
        } else {
          await prisma.resource.create({ data: resourceData });
        }
      }
      // Drop only resources beyond the new list length.
      await prisma.resource.deleteMany({ where: { moduleId: mod.id, order: { gte: resources.length } } });
    }
  }

  // Remove only modules/sections genuinely dropped from the curriculum above.
  const removedModules = await prisma.module.deleteMany({
    where: { section: { courseId: course.id }, code: { notIn: keptModuleCodes } },
  });
  await prisma.section.deleteMany({
    where: { courseId: course.id, id: { notIn: keptSectionIds } },
  });

  if (removedModules.count) console.log(`Removed ${removedModules.count} module(s) no longer in the curriculum.`);
  console.log("Curriculum synced in place — existing progress preserved.");

  await seedGraph();
}

// ─────────────────────────────────────────────────────────────────────────────
// Lattice knowledge graph.
//
// Rebuilt from the ground up. The previous version decomposed The List's
// modules into nodes and welded each node to the module it came from, which
// produced course furniture rather than knowledge: regions too vague to hold a
// position in ("Foundations"), nodes that were whole sentences ("Without evals
// you can't tell signal from noise"), and a tick on one module silently
// granting ground on six nodes nobody had defended.
//
// The rules now, applied to every title below:
//   1. The title is the thing, not the contrast.      AGI, never "ANI vs AGI".
//   2. The title is canonical outside this course.    Embeddings, not "the one-second rule".
//   3. One to three words, no preposition.            If it needs one, it is a sentence.
//   4. A node is a space, not a fact.                 A fact goes in a body; a field is a Region.
//
// Regions are wayfinding only and are never holdable. Coverage is a many-to-many
// (node, resource, depth) relation, so a resource covers many nodes and a node
// is covered by many resources — and only DEFINES/DEMONSTRATES can provisionally
// hold a node.
// ─────────────────────────────────────────────────────────────────────────────

type RegionDef = { slug: string; name: string; blurb: string };
type NodeDef = {
  slug: string;
  title: string;
  summary: string;
  /** What it actually means. */
  means: string;
  /** What people reliably get wrong about it. */
  wrong: string;
  /** How you hold your ground — the argument, with something concrete in it. */
  defend: string;
  kind: "CONCEPT" | "DECISION" | "CONSTRAINT";
  region: string;
};
type EdgeDef = [from: string, to: string, kind: "REFINES" | "ADJACENT" | "TENSION"];
type Depth = "DEFINES" | "DEMONSTRATES" | "MENTIONS";
/** [content key (URL, or title for a resource without one), node slug, depth, curator's note, confidence, startSec?] */
type CoverageDef = [key: string, slug: string, depth: Depth, note: string, confidence: number, startSec?: number];

const REGIONS: RegionDef[] = [
  { slug: "machine-learning", name: "Machine learning", blurb: "How a system learns behaviour from examples instead of being told the rules." },
  { slug: "language-models", name: "Language models", blurb: "What an LLM is doing when it answers, and what it cannot see." },
  { slug: "data", name: "Data", blurb: "The fuel, and where the ceiling on any model actually sits." },
  { slug: "applied-ai", name: "Applied AI", blurb: "Getting work out of a model: the levers, the loop, and how you know it worked." },
  { slug: "law-governance", name: "Law & governance", blurb: "The rules that already apply, and oversight that means something." },
];

const NODES: NodeDef[] = [
  // ── Machine learning ───────────────────────────────────────────────────────
  {
    slug: "agi", title: "AGI", kind: "CONCEPT", region: "machine-learning",
    summary: "AI that is good at roughly anything a person is good at.",
    means: "An AI that is good at roughly anything a human is good at, rather than at one defined task.",
    wrong: "Heard as superintelligence, and filled in with whatever dystopia you grew up watching. The word triggers the film, not the definition.",
    defend: "Separate narrow from general and the argument settles. Kasparov lost to a machine that could do precisely one thing and nothing else — enormously valuable, entirely narrow. Breadth is the claim at issue, not power, and breadth is what recently changed.",
  },
  {
    slug: "supervised-learning", title: "Supervised learning", kind: "CONCEPT", region: "machine-learning",
    summary: "Learning a mapping from input to output out of labelled examples.",
    means: "You supply pairs — an input and the right answer — and the system learns the mapping between them.",
    wrong: "Imagined as the machine teaching itself. Someone paid for every label it learned from.",
    defend: "Almost all the money AI makes today is one input mapped to one output: email to spam-or-not, claim to fraud-or-not, scan to finding. Name the A and the B in your own case and you can tell inside a minute whether it is a supervised-learning problem at all.",
  },
  {
    slug: "deep-learning", title: "Deep learning", kind: "CONCEPT", region: "machine-learning",
    summary: "Stacked layers that learn their own features instead of being handed them.",
    means: "Many layers of simple units, each learning features from the layer below, so nobody hand-engineers what to look for.",
    wrong: "Used as a synonym for AI, and credited to a conceptual breakthrough.",
    defend: "It is one technique among several and the ideas are decades old. What arrived recently was data and compute, not insight. More scale has kept buying more capability — worth knowing as a footnote, not a law to plan around.",
  },
  {
    slug: "automation", title: "Automation", kind: "CONCEPT", region: "machine-learning",
    summary: "AI takes tasks out of jobs, not jobs out of the world.",
    means: "The unit that gets automated is a task, not a job. Jobs are bundles of tasks, and bundles recompose.",
    wrong: "Collapses into one of two slogans: mass unemployment, or nothing will change.",
    defend: "Decompose a job into its tasks and score them one at a time. Some go, some get faster, some are untouched, and the job is rebuilt around what is left. That is a claim you can check against a real role this week.",
  },

  // ── Language models ────────────────────────────────────────────────────────
  {
    slug: "next-token-prediction", title: "Next-token prediction", kind: "CONCEPT", region: "language-models",
    summary: "A language model picks the next fragment of text, over and over.",
    means: "The model's only move is to score which token comes next and pick one. Everything else is that move repeated.",
    wrong: "Mistaken for comprehension, because the output reads like it. The same mistake explains why people are surprised it cannot reliably count the letters in a word: it never saw the letters, only the fragments.",
    defend: "Fluency and correctness come out of the same mechanism, which is exactly why they come apart. Nothing in picking a likely next token rewards being right — only being likely — so it never has to know it is wrong in order to sound right.",
  },
  {
    slug: "embeddings", title: "Embeddings", kind: "CONCEPT", region: "language-models",
    summary: "Meaning represented as a position in space.",
    means: "Words, sentences and documents are turned into long lists of numbers, positioned so that related things sit near each other.",
    wrong: "Treated as a storage format, as though the text were in there and could be read back out.",
    defend: "It is a measure of nearness, not a container. That is precisely why search over embeddings finds a document that never uses your words — and why nothing guarantees you can recover the original text from them.",
  },
  {
    slug: "transformers", title: "Transformers", kind: "CONCEPT", region: "language-models",
    summary: "The architecture that lets a model weigh every part of its input at once.",
    means: "An architecture whose central move, attention, lets each position look at every other position and decide what matters.",
    wrong: "Taken for a brand or a product rather than a design that essentially everyone now uses.",
    defend: "Attention made training parallel, and parallel training made scale affordable. Nearly every model you will be sold is a transformer, so the architecture is not where vendors actually differ.",
  },
  {
    slug: "context-window", title: "Context window", kind: "CONSTRAINT", region: "language-models",
    summary: "Everything the model can see on this one call.",
    means: "The fixed budget of text the model can attend to in a single call. Outside it, nothing exists.",
    wrong: "Assumed to be memory. People expect last week's conversation to still be in there.",
    defend: "Between calls it remembers nothing you did not resend. Every product that appears to remember is re-pasting something on your behalf. Ask a vendor what goes into the window, who assembles it, and who pays for it.",
  },
  {
    slug: "foundation-models", title: "Foundation models", kind: "CONCEPT", region: "language-models",
    summary: "One general base adapted to many tasks.",
    means: "A single large model trained broadly, then adapted to many downstream uses instead of a new model built per task.",
    wrong: "Read as general competence, so a model that drafts well is assumed to decide well.",
    defend: "What changed is the economics, not the epistemics: adaptation got cheap, which is why every task now starts from the same base. The breadth of the base says nothing about reliability on your task — that is what evaluation is for.",
  },
  {
    slug: "pretraining", title: "Pretraining", kind: "CONCEPT", region: "language-models",
    summary: "The long, expensive pass that builds the base.",
    means: "The one-off run over a vast corpus that produces the base model. Everything after it is comparatively cheap shaping.",
    wrong: "Confused with fine-tuning, and assumed to be where your own data would go.",
    defend: "Pretrain, then fine-tune, then align: three stages whose costs differ by orders of magnitude. You will never pretrain anything. Knowing the stages is how you work out which one a vendor is actually selling you.",
  },
  {
    slug: "alignment", title: "Alignment", kind: "CONCEPT", region: "language-models",
    summary: "Shaping a model to behave as intended.",
    means: "The stage that turns a raw predictor into something that follows instructions and declines what it ought to decline.",
    wrong: "Taken for a safety guarantee, or dismissed as censorship.",
    defend: "It is trained behaviour, not an enforced rule, so it holds statistically and fails under pressure. That is at once why assistants are usable at all and why alignment is not a control you can audit like a permission.",
  },
  {
    slug: "hallucination", title: "Hallucination", kind: "CONSTRAINT", region: "language-models",
    summary: "Confident output with nothing behind it.",
    means: "The model produces something fluent and plausible that is simply not so, with no signal that anything went wrong.",
    wrong: "Treated as a bug awaiting a patch, or as the model lying.",
    defend: "It is the mechanism working normally. The same next-token machinery that makes a good answer likely makes a wrong answer likely when the right one is out of reach. There is no intent and no internal alarm, which is why grounding and checking are design requirements rather than polish.",
  },

  // ── Data ───────────────────────────────────────────────────────────────────
  {
    slug: "data-quality", title: "Data quality", kind: "CONSTRAINT", region: "data",
    summary: "Signal, coverage and labelling set the ceiling.",
    means: "How clean, how representative and how consistently labelled your data is decides the best result any model can reach on it.",
    wrong: "More data is assumed to beat better data.",
    defend: "In the long tail you do not have millions of examples, you have fifty — and fifty clean, consistently labelled ones beat fifty thousand dirty ones outright. Usage improves data and better data improves the product, but that loop only turns once labelling is consistent enough to measure.",
  },
  {
    slug: "data-science", title: "Data science", kind: "CONCEPT", region: "data",
    summary: "Insight a person acts on, not a system that acts.",
    means: "Analysis whose output is a conclusion for a human decision, as against a model running inside a process.",
    wrong: "Used interchangeably with machine learning, so work gets staffed and measured as the wrong thing.",
    defend: "Look at the deliverable. If it is a finding somebody reads and acts on, it is data science; if it is something that runs and decides repeatedly, it is machine learning. Different teams, different timelines, different ways of being wrong.",
  },

  // ── Applied AI ─────────────────────────────────────────────────────────────
  {
    slug: "prompting", title: "Prompting", kind: "CONCEPT", region: "applied-ai",
    summary: "The first lever, and usually the cheapest.",
    means: "Changing what you put into the context in order to change what comes out, with no change to the model.",
    wrong: "Dismissed as a trick, or inflated into a profession.",
    defend: "It is the only lever with no training cost and no infrastructure, so it is where you find out whether the task is feasible at all. Reach past it before trying it and you buy a training run to fix a wording problem.",
  },
  {
    slug: "rag", title: "RAG", kind: "CONCEPT", region: "applied-ai",
    summary: "Retrieve your own documents, then answer from them.",
    means: "Fetch the relevant passages from your corpus and put them in the context, so the answer is grounded in them.",
    wrong: "Believed to teach the model your documents.",
    defend: "Nothing is learned; passages are pasted in at answer time. That is the advantage — change a document and the next answer changes — and it is also the limit: if retrieval misses the right passage, the model will answer anyway.",
  },
  {
    slug: "fine-tuning", title: "Fine-tuning", kind: "DECISION", region: "applied-ai",
    summary: "Changes behaviour, not what it knows.",
    means: "Further training on your own examples to shift format, tone and how the model approaches a task.",
    wrong: "Reached for to make a model \"know our business\".",
    defend: "It moves behaviour reliably and facts barely at all, and it freezes whatever it learned on the day it ran. For current, specific knowledge you want retrieval; for a consistent shape of output you want fine-tuning.",
  },
  {
    slug: "agents", title: "Agents", kind: "CONCEPT", region: "applied-ai",
    summary: "A model acting in a loop, not just answering.",
    means: "A model that acts, observes the result, and acts again until the task is done or it gives up.",
    wrong: "Treated as a smarter model. It is the same model, in a loop.",
    defend: "The capability gain comes from the loop and the tools, not from the model getting cleverer — which is why the hard questions are all about the loop: what it can touch, how it knows it is finished, and what happens on step nine of ten.",
  },
  {
    slug: "tool-use", title: "Tool use", kind: "CONCEPT", region: "applied-ai",
    summary: "Letting the model call things that actually work.",
    means: "Giving the model functions it can call — search, a database, code, an API — with results coming back into its context.",
    wrong: "Thought to make the model reliable, because the arithmetic now comes out right.",
    defend: "It fixes what tools are good at and moves the risk rather than removing it: the model still chooses when to call, with what arguments, and whether to believe what comes back. A model with tools fails differently, not less often.",
  },
  {
    slug: "autonomy", title: "Autonomy", kind: "DECISION", region: "applied-ai",
    summary: "A dial, and it sets your blast radius.",
    means: "How far the system may act without a human in the path — a range of settings, not a yes or a no.",
    wrong: "Posed as a switch: either a human approves everything or the thing runs itself.",
    defend: "Every notch up multiplies the value and the cost of being wrong at the same time. The design question is never \"autonomous or not\" but which step a human sits on, and what it costs to be wrong at that step.",
  },
  {
    slug: "evaluation", title: "Evaluation", kind: "CONCEPT", region: "applied-ai",
    summary: "Without it you cannot tell a change from an improvement.",
    means: "A fixed set of cases with known-good outcomes, run against every change, so you can see whether the change actually helped.",
    wrong: "Substituted with a demo, or with a vendor's benchmark score.",
    defend: "Measure the humans first or you have no baseline to beat. Vibes move with whoever ran the demo; cases do not. An unmeasured baseline is how a project comes to report a lift it never had.",
  },
  {
    slug: "prompt-injection", title: "Prompt injection", kind: "CONSTRAINT", region: "applied-ai",
    summary: "Text the model reads can redirect it.",
    means: "Content the model ingests — a page, a document, an email — carries instructions, and the model has no reliable way to tell those from yours.",
    wrong: "Filed as a jailbreak problem, i.e. as being about users misbehaving.",
    defend: "It is a data-trust problem, not a user problem: anything the model reads becomes a possible instruction. That is why it gets sharply worse with tools and autonomy, and why the mitigation is limiting what the system can do rather than wording things better.",
  },

  // ── Law & governance ───────────────────────────────────────────────────────
  {
    slug: "eu-ai-act", title: "EU AI Act", kind: "CONSTRAINT", region: "law-governance",
    summary: "Obligations follow the use, not the technology.",
    means: "A tiered regime: a use is prohibited, high-risk, limited-risk or minimal, and the duties attach to the tier.",
    wrong: "Read as a ban on AI, or as something that applies to the model you bought.",
    defend: "The same model is unregulated in one use and high-risk in another, because the tier is set by what you do with it. So the first question is never \"is this model compliant\" — it is which tier your use sits in.",
  },
  {
    slug: "gdpr", title: "GDPR", kind: "CONSTRAINT", region: "law-governance",
    summary: "Still applies, in full, already.",
    means: "Lawful basis, purpose limitation, minimisation and data-subject rights apply to personal data in an AI system exactly as they do anywhere else.",
    wrong: "Assumed to be superseded or somehow suspended by the AI Act.",
    defend: "The AI Act adds duties; it removes none. In practice GDPR is the obligation that bites first and the one you already have the machinery for, which makes it the fastest route to a deployment you can defend.",
  },
  {
    slug: "human-oversight", title: "Human oversight", kind: "DECISION", region: "law-governance",
    summary: "Real only if the person can actually intervene.",
    means: "Someone positioned to understand the output and able to stop, change or override it inside the live process.",
    wrong: "Satisfied with an approval click, which records a decision nobody had the time or the information to make.",
    defend: "Oversight is tested by whether overriding ever happens, and what it costs the person who does it. If nobody has ever said no, you have a sign-off step rather than oversight — and that is the distinction the Act cares about.",
  },
];

const EDGES: EdgeDef[] = [
  // Machine learning
  ["supervised-learning", "deep-learning", "ADJACENT"],
  ["supervised-learning", "automation", "ADJACENT"],
  ["agi", "foundation-models", "ADJACENT"],
  ["agi", "automation", "TENSION"],
  ["deep-learning", "data-quality", "TENSION"],
  // Language models
  ["deep-learning", "transformers", "REFINES"],
  ["transformers", "next-token-prediction", "ADJACENT"],
  ["transformers", "embeddings", "ADJACENT"],
  ["next-token-prediction", "hallucination", "REFINES"],
  ["next-token-prediction", "context-window", "ADJACENT"],
  ["foundation-models", "pretraining", "REFINES"],
  ["foundation-models", "deep-learning", "ADJACENT"],
  ["pretraining", "alignment", "ADJACENT"],
  ["alignment", "hallucination", "TENSION"],
  ["alignment", "prompt-injection", "TENSION"],
  ["embeddings", "rag", "ADJACENT"],
  ["context-window", "rag", "ADJACENT"],
  // Data
  ["data-quality", "data-science", "ADJACENT"],
  ["data-quality", "supervised-learning", "ADJACENT"],
  ["data-quality", "fine-tuning", "ADJACENT"],
  ["data-science", "evaluation", "ADJACENT"],
  // Applied AI
  ["prompting", "next-token-prediction", "ADJACENT"],
  ["prompting", "rag", "ADJACENT"],
  ["prompting", "fine-tuning", "TENSION"],
  ["rag", "fine-tuning", "TENSION"],
  ["agents", "tool-use", "REFINES"],
  ["agents", "autonomy", "ADJACENT"],
  ["tool-use", "prompt-injection", "ADJACENT"],
  ["autonomy", "prompt-injection", "ADJACENT"],
  ["autonomy", "human-oversight", "TENSION"],
  ["evaluation", "hallucination", "ADJACENT"],
  ["evaluation", "autonomy", "ADJACENT"],
  // Law & governance
  ["eu-ai-act", "human-oversight", "REFINES"],
  ["eu-ai-act", "gdpr", "ADJACENT"],
  ["eu-ai-act", "foundation-models", "ADJACENT"],
  ["eu-ai-act", "automation", "ADJACENT"],
  ["gdpr", "data-quality", "ADJACENT"],
  ["human-oversight", "evaluation", "ADJACENT"],
];

// ─────────────────────────────────────────────────────────────────────────────
// Coverage: which piece of content covers which node, and how deeply.
//
// Keyed by the content, not by where it sits in The List. Several videos are
// placed in more than one module (Karpathy's talk is in D1-A, D1-C and SRC-1);
// each placement is its own Resource row, but it is one video, so every copy
// gets the same rows here and a tick on one copy ticks them all
// (src/lib/sameresource.ts). The key is the URL; exercises have none and are
// keyed by their title.
//
// DEFINES      — the resource sets the concept up; watching it is a fair claim
//                to have met the idea properly.
// DEMONSTRATES — the resource works the idea in a concrete case without
//                defining it.
// MENTIONS     — the idea goes past. Grants nothing. This is why the 8-minute
//                "AI for Everyone orientation" below yields zero holdings: a
//                course trailer cannot hand you ground on supervised learning.
//
// `confidence` is honest, not decorative:
//   0.85+    the content and its structure are well known (chapter-level), and
//            the row is placed against that structure.
//   0.6–0.8  the content is known in outline; depth is a judgement.
//   ≤ 0.55   inferred from the resource's title or the course it summarises;
//            the transcript pipeline or a human should confirm.
// Nothing here was checked against a transcript, so no row is marked reviewed,
// and every row is source SEED. `startSec`, where given, is the chapter start.
//
// Exercises that teach procurement or practice rather than AI — the 30-day
// commitment — put no nodes on the map. The six-question script and the
// one-pager do: building a labelled eval set and naming the human fallback are
// the evaluation and human-oversight nodes, done by hand on a real case.
// ─────────────────────────────────────────────────────────────────────────────

const NG_ELECTRICITY = "https://www.youtube.com/watch?v=21EiKfQYZXc";
const NG_TED = "https://www.youtube.com/watch?v=reUZRyXxUs4";
const ORIENTATION = "https://www.youtube.com/watch?v=JPcx9qHzzgk";
const GENAI_25 = "https://www.youtube.com/watch?v=qpWqrIsaKwo";
const LLM_BRIEFLY = "https://www.youtube.com/watch?v=LPZh9BOjkQs";
const FM_EXPLAINER = "https://www.youtube.com/watch?v=kK3NmQT241w";
const ELEMENTS = "https://www.elementsofai.com/";
const TRANSFORMERS = "https://www.youtube.com/watch?v=wjZofJX0v4M";
const INTRO_LLM = "https://www.youtube.com/watch?v=zjkBMFhNj_g";
const NINE_CONCEPTS = "https://www.youtube.com/watch?v=nVnxG10D5W0";
const AI_ACT = "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai";
const EVALS_BUILD = "https://www.youtube.com/watch?v=mF4CaijvJos";
const EVALS_DEPTH = "https://www.youtube.com/watch?v=BsWxPI9UM4c";
const DECISION_FIRST = "https://www.youtube.com/watch?v=HjRtK0JguBY";
const STATE_OF_GPT = "https://www.youtube.com/watch?v=bZQun8Y4L2A";
const EVALS_MISTAKES = "https://www.youtube.com/watch?v=GL0XhAj5LPE";
const BUILD_GPT = "https://www.youtube.com/watch?v=kCc8FmEb1nY";
const FM_WORKSHOP = "https://www.youtube.com/playlist?list=PLYLBSCrrqNXz1RQCVwv7mApexCcn7Bybk";
const RED_PEN = "Red-pen three answers: claim / evidence / missing";
const UNIT_OF_WORK = "Name the unit of work";
const SIX_QUESTIONS = "Run the six-question script against a real pitch";
const ONE_PAGER = "One page per candidate use";

const IBM_RAG = "https://www.youtube.com/watch?v=T-D1OfcDW1M";
const IBM_RAG_FT = "https://www.youtube.com/watch?v=00Q0G84kq3M";
const EFFECTIVE_AGENTS = "https://www.youtube.com/watch?v=D7_ipDqhtwk";
const SHNEIDERMAN = "https://www.youtube.com/watch?v=o5XwczIERvM";
const LEGG_AGI = "https://www.youtube.com/watch?v=l3u_FAv33G0";
const CNIL_GDPR = "https://www.cnil.fr/en/ai-system-development-cnils-recommendations-to-comply-gdpr";

const COVERAGE: CoverageDef[] = [
  // ── Andrew Ng · AI is the New Electricity (Stanford GSB, 2017) ───────────
  [NG_ELECTRICITY, "supervised-learning", "DEFINES", "The A-to-B segment: almost all of AI's economic value so far is one input mapped to one output.", 0.9],
  [NG_ELECTRICITY, "deep-learning", "DEFINES", "Why it took off when it did: performance against data for small and large networks — data and compute, not a new idea.", 0.85],
  [NG_ELECTRICITY, "automation", "DEMONSTRATES", "The one-second rule: work made of one-second judgements strung together is what can be automated — tasks, not jobs.", 0.8],
  [NG_ELECTRICITY, "data-quality", "MENTIONS", "Data framed as the asset and the virtuous cycle — an argument about quantity, the opposite of this node's claim.", 0.7],
  [NG_ELECTRICITY, "agi", "MENTIONS", "Evil-AI fear dismissed (overpopulation on Mars); narrow versus general is not developed.", 0.6],

  // ── Andrew Ng · How AI Could Empower Any Business (TED, 2022) ────────────
  [NG_TED, "data-quality", "DEFINES", "The long-tail argument and data-centric AI: fifty good examples, not fifty million.", 0.85],
  [NG_TED, "supervised-learning", "MENTIONS", "Assumed as background rather than taught.", 0.75],
  [NG_TED, "automation", "MENTIONS", "The talk is about who can build custom AI, not which tasks it displaces.", 0.65],

  // ── DeepLearning.AI · AI for Everyone orientation (8 min trailer) ─────────
  [ORIENTATION, "supervised-learning", "MENTIONS", "Named in the course overview. Eight minutes of orientation is not coverage.", 0.9],
  [ORIENTATION, "data-science", "MENTIONS", "Named in the course overview.", 0.85],
  [ORIENTATION, "agi", "MENTIONS", "Named in the course overview.", 0.85],

  // ── Tina Huang · Generative AI for Everyone in 25 minutes ────────────────
  // A speed-run of Ng's three-week course. Rows follow the course's syllabus;
  // a 25-minute cut gives each topic a minute or two, so only what the course
  // works in examples is above MENTIONS.
  [GENAI_25, "next-token-prediction", "DEFINES", "Ng's framing: an LLM is supervised learning applied to predicting the next word, repeatedly. From the course syllabus — confirm.", 0.6],
  [GENAI_25, "supervised-learning", "DEMONSTRATES", "Recapped as the base generative AI is built on. From the course syllabus — confirm.", 0.55],
  [GENAI_25, "hallucination", "DEMONSTRATES", "What LLMs can and cannot do: knowledge cut-off and made-up facts. From the course syllabus — confirm.", 0.55],
  [GENAI_25, "prompting", "DEMONSTRATES", "Prompting tips: be detailed, guide the model, iterate. From the course syllabus — confirm.", 0.6],
  [GENAI_25, "automation", "DEMONSTRATES", "Week 3's task-based analysis of jobs, augmentation against automation. From the course syllabus — confirm.", 0.55],
  [GENAI_25, "context-window", "MENTIONS", "Limited input and output length, among the model's limits.", 0.5],
  [GENAI_25, "rag", "MENTIONS", "Week 2 lists RAG as a technique.", 0.55],
  [GENAI_25, "fine-tuning", "MENTIONS", "Week 2 lists fine-tuning as a technique.", 0.55],
  [GENAI_25, "pretraining", "MENTIONS", "Pretraining your own model, raised and dismissed.", 0.5],
  [GENAI_25, "alignment", "MENTIONS", "Instruction tuning and RLHF, briefly.", 0.5],
  [GENAI_25, "agents", "MENTIONS", "Tool use and agents, briefly.", 0.5],
  [GENAI_25, "agi", "MENTIONS", "Week 3's AGI concern.", 0.5],

  // ── 3Blue1Brown · Large Language Models explained briefly (8 min) ─────────
  [LLM_BRIEFLY, "next-token-prediction", "DEFINES", "The whole explainer is built on the next-word probability move.", 0.9],
  [LLM_BRIEFLY, "transformers", "DEMONSTRATES", "Attention and feed-forward blocks shown rather than derived.", 0.85],
  [LLM_BRIEFLY, "pretraining", "DEMONSTRATES", "Pretraining named, with the scale of compute made concrete.", 0.8],
  [LLM_BRIEFLY, "alignment", "MENTIONS", "RLHF in one sentence: people flag unhelpful predictions.", 0.8],
  [LLM_BRIEFLY, "embeddings", "MENTIONS", "Words as lists of numbers, in passing.", 0.75],
  [LLM_BRIEFLY, "deep-learning", "MENTIONS", "Parameters tuned by backpropagation, in passing.", 0.7],

  // ── Stanford HAI · Foundation Models explainer (2 min) ───────────────────
  [FM_EXPLAINER, "foundation-models", "DEFINES", "Two minutes, one definition, done well.", 0.85],

  // ── University of Helsinki · Elements of AI (course) ─────────────────────
  // Written in 2018: nothing here on language models.
  [ELEMENTS, "supervised-learning", "DEFINES", "Chapter 4, types of machine learning.", 0.8],
  [ELEMENTS, "deep-learning", "DEFINES", "Chapter 5, neural networks.", 0.75],
  [ELEMENTS, "agi", "DEFINES", "Chapter 1: general versus narrow, strong versus weak AI.", 0.75],
  [ELEMENTS, "automation", "MENTIONS", "Chapter 6, implications for work.", 0.6],
  [ELEMENTS, "data-quality", "MENTIONS", "Chapter 6, bias from training data.", 0.5],

  // ── 3Blue1Brown · Transformers, the tech behind LLMs (DL ch. 5, 27 min) ───
  // Attention itself is chapter 6, a different video; this one is the overview.
  [TRANSFORMERS, "next-token-prediction", "DEFINES", "Predict, sample, repeat — the opening section.", 0.9, 0],
  [TRANSFORMERS, "embeddings", "DEFINES", "Word embeddings: directions that carry meaning, nearness as similarity.", 0.9, 747],
  [TRANSFORMERS, "transformers", "DEMONSTRATES", "The data flow through attention and MLP blocks; attention is deferred to the next chapter.", 0.85, 183],
  [TRANSFORMERS, "context-window", "DEMONSTRATES", "Context size as the fixed number of vectors the network can see at once.", 0.8, 1105],
  [TRANSFORMERS, "deep-learning", "DEMONSTRATES", "The premise of deep learning: weights, matrices, training by backpropagation.", 0.8, 440],

  // ── Andrej Karpathy · Intro to Large Language Models (Nov 2023, 60 min) ───
  // In The List three times (D1-A, D1-C, SRC-1); one video, one set of rows.
  [INTRO_LLM, "next-token-prediction", "DEFINES", "The network's one job: predict the next word. Training as compression of the internet.", 0.9, 257],
  [INTRO_LLM, "pretraining", "DEFINES", "Stage one: ten terabytes, six thousand GPUs, twelve days, about two million dollars.", 0.9, 257],
  [INTRO_LLM, "hallucination", "DEMONSTRATES", "'LLM dreams': the base model invents an ISBN and a product page that never existed.", 0.85, 538],
  [INTRO_LLM, "fine-tuning", "DEFINES", "Stage two: swap the corpus for ~100k curated conversations; format changes, knowledge comes from pretraining.", 0.85, 854],
  [INTRO_LLM, "alignment", "DEFINES", "Labelling instructions (helpful, truthful, harmless), comparisons and RLHF; jailbreaks later show it failing under pressure.", 0.8, 1265],
  [INTRO_LLM, "tool-use", "DEFINES", "Browsing, a calculator, Python for a chart, DALL·E — the model choosing to call tools.", 0.9, 1663],
  [INTRO_LLM, "agents", "DEMONSTRATES", "The Scale AI example: search, compute, plot, extrapolate — a multi-step tool loop in action.", 0.7, 1663],
  [INTRO_LLM, "context-window", "DEMONSTRATES", "The LLM OS: the context window as working memory (RAM), paged in from files and the web.", 0.8, 2535],
  [INTRO_LLM, "prompt-injection", "DEFINES", "Hidden text in a web page and a shared Google Doc that hijack the model; data exfiltration.", 0.9, 3090],
  [INTRO_LLM, "transformers", "MENTIONS", "The architecture is fully known; what the hundred billion parameters do is not.", 0.8, 682],
  [INTRO_LLM, "rag", "MENTIONS", "Customisation: GPTs with uploaded files, retrieval named.", 0.75, 2445],
  [INTRO_LLM, "prompting", "MENTIONS", "Custom instructions as the lightest customisation.", 0.6, 2445],
  [INTRO_LLM, "evaluation", "MENTIONS", "The Chatbot Arena Elo leaderboard.", 0.7, 1265],
  [INTRO_LLM, "foundation-models", "MENTIONS", "Base model against assistant model; the term itself is not used.", 0.65, 854],
  [INTRO_LLM, "data-quality", "MENTIONS", "Fine-tuning prefers quality over quantity.", 0.6, 854],
  [INTRO_LLM, "deep-learning", "MENTIONS", "The neural network as background.", 0.7],
  [INTRO_LLM, "autonomy", "MENTIONS", "System 2 thinking and self-improvement as future directions.", 0.5, 2100],

  // ── Red-pen exercise (D1-A) ──────────────────────────────────────────────
  [RED_PEN, "hallucination", "DEMONSTRATES", "The exercise is claim / evidence / missing against three prepared answers.", 0.9],
  [RED_PEN, "evaluation", "DEMONSTRATES", "Judging output against fixed criteria, by hand.", 0.8],

  // ── 9 AI Concepts Explained in 7 minutes ─────────────────────────────────
  // Full title: "AI Agents, RAGs, Tokenization, RLHF, Diffusion, LoRA…". Under
  // a minute per concept: enough to name each one in context, not to define it.
  [NINE_CONCEPTS, "rag", "DEMONSTRATES", "A RAG segment, named in the full title. Under a minute — confirm.", 0.55],
  [NINE_CONCEPTS, "agents", "DEMONSTRATES", "An agents segment, named in the full title. Under a minute — confirm.", 0.55],
  [NINE_CONCEPTS, "fine-tuning", "DEMONSTRATES", "LoRA, named in the full title, is fine-tuning cheaply. Under a minute — confirm.", 0.5],
  [NINE_CONCEPTS, "alignment", "MENTIONS", "RLHF, named in the full title.", 0.6],
  [NINE_CONCEPTS, "embeddings", "MENTIONS", "Tokenization and vectors, in passing.", 0.5],

  // ── Unit-of-work exercise (D1-C) ─────────────────────────────────────────
  [UNIT_OF_WORK, "automation", "DEMONSTRATES", "The exercise is task decomposition on a real process.", 0.9],
  [UNIT_OF_WORK, "autonomy", "DEMONSTRATES", "Deciding which step keeps a human on it.", 0.75],
  [UNIT_OF_WORK, "human-oversight", "DEMONSTRATES", "Naming the human fallback, and what a confident error costs.", 0.75],

  // ── EU AI Act · official overview (European Commission) ──────────────────
  [AI_ACT, "eu-ai-act", "DEFINES", "The official risk tiers, from the source.", 0.9],
  [AI_ACT, "human-oversight", "MENTIONS", "One line in the list of high-risk obligations.", 0.75],
  [AI_ACT, "foundation-models", "MENTIONS", "General-purpose AI models and their transparency and systemic-risk duties.", 0.7],
  [AI_ACT, "data-quality", "MENTIONS", "High-quality datasets as a high-risk obligation.", 0.7],
  [AI_ACT, "gdpr", "MENTIONS", "Data protection, at most in passing; the CNIL guidance (D1-D) is where GDPR is taught.", 0.4],

  // ── Evaluation (D2-A, SRC-1) ─────────────────────────────────────────────
  [EVALS_BUILD, "evaluation", "DEFINES", "Error analysis on real traces, then evals built from the failures found.", 0.8],
  [EVALS_BUILD, "hallucination", "MENTIONS", "A failure mode to measure.", 0.5],
  [EVALS_DEPTH, "evaluation", "DEFINES", "Error analysis, open and axial coding, binary LLM judges checked against a person.", 0.85],
  [EVALS_DEPTH, "data-quality", "MENTIONS", "One domain expert labels, so the labels stay consistent.", 0.6],
  [EVALS_MISTAKES, "evaluation", "DEFINES", "Evaluation taught through its failure modes.", 0.75],
  [EVALS_MISTAKES, "data-quality", "MENTIONS", "Unrepresentative eval sets as a data problem.", 0.5],

  // ── Kuang Xu · Class Takeaways, Data Science and AI Strategy (5 min) ──────
  [DECISION_FIRST, "data-science", "DEFINES", "The two pillars: analytics a person acts on, against automated decisions built into a product.", 0.75],
  [DECISION_FIRST, "automation", "MENTIONS", "Automated decision-making as one pillar; tasks are not decomposed.", 0.6],
  [DECISION_FIRST, "data-quality", "MENTIONS", "Data on its own is often not a moat.", 0.6],

  // ── Andrej Karpathy · State of GPT (Microsoft Build, 2023) ───────────────
  [STATE_OF_GPT, "pretraining", "DEFINES", "The pretraining stage, its data mix and its cost.", 0.9],
  [STATE_OF_GPT, "fine-tuning", "DEFINES", "Supervised fine-tuning, then LoRA among the recommendations.", 0.9],
  [STATE_OF_GPT, "alignment", "DEFINES", "Reward modelling and RLHF as the third stage.", 0.9],
  [STATE_OF_GPT, "prompting", "DEFINES", "The second half: tokens need tokens to think, chain of thought, ask for expert performance.", 0.85],
  [STATE_OF_GPT, "next-token-prediction", "DEFINES", "Base models as token simulators; tokenisation and the training objective.", 0.85],
  [STATE_OF_GPT, "rag", "DEMONSTRATES", "Retrieval-augmented generation: chunk, embed, retrieve, stuff into the prompt.", 0.8],
  [STATE_OF_GPT, "context-window", "DEMONSTRATES", "The context window as the transformer's working memory.", 0.8],
  [STATE_OF_GPT, "foundation-models", "DEMONSTRATES", "Base models are not assistants; one base shaped for many uses.", 0.75],
  [STATE_OF_GPT, "tool-use", "DEMONSTRATES", "Calculators and code interpreters for what the model is bad at.", 0.7],
  [STATE_OF_GPT, "embeddings", "MENTIONS", "Embeddings as the retrieval index.", 0.7],
  [STATE_OF_GPT, "transformers", "MENTIONS", "The architecture as background.", 0.7],
  [STATE_OF_GPT, "hallucination", "MENTIONS", "Models do not know what they do not know.", 0.6],
  [STATE_OF_GPT, "evaluation", "MENTIONS", "The Elo leaderboard.", 0.6],

  // ── Andrej Karpathy · Let's build GPT from scratch (SRC-2) ───────────────
  [BUILD_GPT, "transformers", "DEFINES", "Self-attention built line by line.", 0.95],
  [BUILD_GPT, "next-token-prediction", "DEFINES", "From a bigram model to the training objective, in code.", 0.9],
  [BUILD_GPT, "deep-learning", "DEMONSTRATES", "Layers, residuals, a training loop — assumes the basics.", 0.85],
  [BUILD_GPT, "embeddings", "DEMONSTRATES", "Token and position embedding tables constructed in code.", 0.85],
  [BUILD_GPT, "pretraining", "DEMONSTRATES", "A pretraining run, in miniature.", 0.85],
  [BUILD_GPT, "context-window", "DEMONSTRATES", "block_size: the model sees this many tokens and nothing else.", 0.85],
  [BUILD_GPT, "alignment", "MENTIONS", "The closing section on how ChatGPT is fine-tuned and aligned.", 0.8],
  [BUILD_GPT, "fine-tuning", "MENTIONS", "The closing section.", 0.8],

  // ── Stanford HAI · Foundation Models workshop (playlist) ─────────────────
  [FM_WORKSHOP, "foundation-models", "DEMONSTRATES", "Playlist — depth inferred, confirm per talk.", 0.55],
  [FM_WORKSHOP, "alignment", "MENTIONS", "Playlist — depth inferred, confirm per talk.", 0.5],

  // ── Vendor script and one-pager (D2-B, D2-C) ─────────────────────────────
  [SIX_QUESTIONS, "evaluation", "DEMONSTRATES", "Question 2: what is the eval set, who labelled it, what is pass/fail.", 0.75],
  [SIX_QUESTIONS, "human-oversight", "DEMONSTRATES", "Question 3: the human fallback when it is wrong and confident.", 0.7],
  [SIX_QUESTIONS, "gdpr", "MENTIONS", "Question 5: what data leaves the building and whether it is trained on.", 0.6],
  [ONE_PAGER, "evaluation", "DEMONSTRATES", "Twenty real examples, labelled by a practitioner, with a kill criterion.", 0.75],

  // ── Added to fill the nodes nothing in The List taught ───────────────────
  [IBM_RAG, "rag", "DEFINES", "Add a content store, retrieve first, answer from it, cite it — and say \"I don't know\" when retrieval comes back empty.", 0.85],
  [IBM_RAG, "hallucination", "DEMONSTRATES", "The out-of-date confident answer RAG exists to correct.", 0.7],
  [IBM_RAG_FT, "fine-tuning", "DEFINES", "Fine-tuning puts the specialism into the weights; when that beats retrieval. From a summary — confirm.", 0.7],
  [IBM_RAG_FT, "rag", "DEMONSTRATES", "RAG for data that changes, set against fine-tuning. From a summary — confirm.", 0.7],
  [EFFECTIVE_AGENTS, "agents", "DEFINES", "An agent is a model using tools in a loop, choosing its own path; a workflow is a fixed path.", 0.8],
  [EFFECTIVE_AGENTS, "autonomy", "DEFINES", "Don't build an agent for everything: complexity, value, de-risked capabilities, and whether errors are easy to catch.", 0.75],
  [EFFECTIVE_AGENTS, "tool-use", "MENTIONS", "Tools as what the loop acts through.", 0.7],
  [SHNEIDERMAN, "autonomy", "DEFINES", "Automation and human control as two axes, not one switch — you can have high levels of both.", 0.75],
  [SHNEIDERMAN, "human-oversight", "DEFINES", "Control that means something: audit trails, failure reporting, independent oversight.", 0.7],
  [SHNEIDERMAN, "automation", "MENTIONS", "Automation as a design choice rather than a destiny.", 0.6],
  [LEGG_AGI, "agi", "DEFINES", "Minimal AGI as the range of a typical person's cognitive abilities; full AGI and beyond; how you would test for it.", 0.7],
  [LEGG_AGI, "automation", "MENTIONS", "What AGI would do to work.", 0.5],
  [CNIL_GDPR, "gdpr", "DEFINES", "Purpose, legal basis, minimisation, data-subject rights and impact assessments, applied to building AI systems.", 0.8],
];

/**
 * Deterministic frozen layout: region centroids on a ring, each region's nodes
 * fanned around its centroid on a radius that grows with membership so dense
 * regions do not pile up. Every region's fan starts at a different angle, so
 * neighbouring regions do not line their nodes up into false rows.
 */
function layout() {
  const CX = 640, CY = 480, RING = 400;
  const regionCentroid = new Map<string, { x: number; y: number }>();
  REGIONS.forEach((r, i) => {
    const a = (i / REGIONS.length) * Math.PI * 2 - Math.PI / 2;
    regionCentroid.set(r.slug, { x: CX + RING * Math.cos(a), y: CY + RING * Math.sin(a) });
  });
  const nodeXY = new Map<string, { x: number; y: number }>();
  REGIONS.forEach((r, ri) => {
    const members = NODES.filter((n) => n.region === r.slug);
    const c = regionCentroid.get(r.slug)!;
    const rad = members.length <= 1 ? 0 : 70 + 11 * members.length;
    const offset = (ri * Math.PI) / REGIONS.length;
    members.forEach((n, j) => {
      const a = (j / members.length) * Math.PI * 2 + offset;
      nodeXY.set(n.slug, { x: c.x + rad * Math.cos(a), y: c.y + rad * Math.sin(a) });
    });
  });
  return { regionCentroid, nodeXY };
}

async function seedGraph() {
  const { regionCentroid, nodeXY } = layout();

  // Regions
  const regionId = new Map<string, string>();
  for (const [i, r] of REGIONS.entries()) {
    const c = regionCentroid.get(r.slug)!;
    const row = await prisma.region.upsert({
      where: { slug: r.slug },
      update: { name: r.name, blurb: r.blurb, labelX: c.x, labelY: c.y, order: i },
      create: { slug: r.slug, name: r.name, blurb: r.blurb, labelX: c.x, labelY: c.y, order: i },
    });
    regionId.set(r.slug, row.id);
  }

  // Nodes
  const nodeId = new Map<string, string>();
  for (const [i, n] of NODES.entries()) {
    const data = {
      title: n.title,
      summary: n.summary,
      whatItMeans: n.means,
      commonlyWrong: n.wrong,
      howToDefend: n.defend,
      kind: n.kind,
      regionId: regionId.get(n.region) ?? null,
      x: nodeXY.get(n.slug)!.x,
      y: nodeXY.get(n.slug)!.y,
      order: i,
      retiredAt: null,
      // If a community-added node's name is later adopted into the vocabulary, the
      // seed takes it over: from then on it is a curated node like any other.
      origin: "SEED",
    };
    const row = await prisma.node.upsert({
      where: { slug: n.slug },
      update: data,
      create: { slug: n.slug, ...data },
    });
    nodeId.set(n.slug, row.id);
  }

  // Retire nodes and regions that are no longer in the vocabulary. Nodes are
  // retired rather than deleted so that holdings, claims and the positions
  // people took on them survive the rebuild; regions carry no user data and are
  // simply removed.
  const keptSlugs = NODES.map((n) => n.slug);
  const retired = await prisma.node.updateMany({
    // COMMUNITY nodes (added by AI-validated expert suggestions) are not in the
    // vocabulary by design; the seed must never retire them.
    where: { slug: { notIn: keptSlugs }, retiredAt: null, origin: { not: "COMMUNITY" } },
    data: { retiredAt: new Date(), regionId: null },
  });
  await prisma.region.deleteMany({ where: { slug: { notIn: REGIONS.map((r) => r.slug) } } });

  // Edges — drop any no longer defined, then add the current set.
  const keepEdgeKeys = new Set(EDGES.map(([f, t, k]) => `${f}|${t}|${k}`));
  for (const e of await prisma.edge.findMany({ include: { from: true, to: true } })) {
    // Edges to or from a community node belong to that node, not the vocabulary.
    if (e.from.origin === "COMMUNITY" || e.to.origin === "COMMUNITY") continue;
    if (!keepEdgeKeys.has(`${e.from.slug}|${e.to.slug}|${e.kind}`))
      await prisma.edge.delete({ where: { id: e.id } });
  }
  for (const [f, t, k] of EDGES) {
    const fromId = nodeId.get(f), toId = nodeId.get(t);
    if (!fromId || !toId) throw new Error(`Edge references an unknown node: ${f} -> ${t}`);
    const existing = await prisma.edge.findUnique({
      where: { fromId_toId_kind: { fromId, toId, kind: k } },
    });
    if (!existing) await prisma.edge.create({ data: { fromId, toId, kind: k } });
  }

  // Coverage — rebuilt from this table on every run; the seed is the source of
  // truth for SEED rows. Rows an admin or the extraction pipeline wrote (source
  // HUMAN or MACHINE) are left alone. Each row applies to every placement of
  // its content in The List.
  await prisma.coverage.deleteMany({ where: { source: "SEED" } });
  const allResources = await prisma.resource.findMany({ select: { id: true, url: true, title: true } });
  const copies = (key: string) =>
    allResources
      .filter((r) => (r.url.trim() ? resourceKey(r.url) === resourceKey(key) : r.title === key))
      .map((r) => r.id);
  let coverageRows = 0;
  const missingResources = new Set<string>();
  for (const [i, [key, slug, depth, note, confidence, startSec]] of COVERAGE.entries()) {
    const nid = nodeId.get(slug);
    if (!nid) throw new Error(`Coverage references an unknown node: ${slug}`);
    const ids = copies(key);
    if (!ids.length) {
      missingResources.add(key);
      continue;
    }
    for (const resourceId of ids) {
      // A HUMAN or MACHINE row for this pair outranks the seed; don't overwrite it.
      const existing = await prisma.coverage.findUnique({
        where: { nodeId_resourceId: { nodeId: nid, resourceId } },
        select: { id: true },
      });
      if (existing) continue;
      await prisma.coverage.create({
        data: { nodeId: nid, resourceId, depth, evidence: note, startSec: startSec ?? null, source: "SEED", confidence, order: i },
      });
      coverageRows++;
    }
  }

  // A tick on one placement of a video is a tick on all of them (the progress
  // API does this from now on); bring ticks made before that into line.
  const ticks = await prisma.progress.findMany({
    where: { completed: true, resourceId: { not: null } },
    select: { userId: true, resourceId: true },
  });
  const byId = new Map(allResources.map((r) => [r.id, r]));
  let mirrored = 0;
  for (const t of ticks) {
    const r = byId.get(t.resourceId!);
    if (!r?.url.trim()) continue;
    for (const id of copies(r.url)) {
      if (id === r.id) continue;
      const has = await prisma.progress.findUnique({
        where: { userId_resourceId: { userId: t.userId, resourceId: id } },
        select: { id: true },
      });
      if (has) continue;
      await prisma.progress.create({ data: { userId: t.userId, resourceId: id, completed: true } });
      mirrored++;
    }
  }

  // Recompute every ticker's provisional holdings against the new coverage —
  // including dropping ground a demoted row no longer supports. Only
  // DEFINES/DEMONSTRATES coverage grants ground; MENTIONS never does.
  const tickers = await prisma.progress.findMany({ distinct: ["userId"], select: { userId: true } });
  for (const { userId } of tickers) await recomputeProvisionalHoldings(userId);

  if (missingResources.size)
    console.warn(
      `Coverage skipped — no matching resource in The List for:\n  ${[...missingResources].join("\n  ")}`
    );
  console.log(
    `Knowledge graph synced: ${REGIONS.length} regions, ${NODES.length} nodes, ` +
      `${EDGES.length} edges, ${coverageRows} coverage row(s); ` +
      `${retired.count} node(s) retired; ${mirrored} tick(s) mirrored across copies; ` +
      `provisional holdings recomputed for ${tickers.length} user(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
