import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
          "Learn the mechanism in plain terms, then run one real document through three assistants and mark, in red, what is wrong.",
        body: `**Learn these first, then treat the videos as clips:**

- **Token ≠ thought** — a token is a chunk of text
- **Next-token prediction is the whole trick**
- **Training vs inference** — training is the one-off, expensive part that sets the weights; inference is what you pay for on every query
- **Temperature** means the same prompt is not a laboratory method — you will not get the same answer twice
- **Hallucination** is unconstrained pattern completion — the model fills a plausible pattern with no obligation to be grounded

**Exercise (20 min).** Paste the first page of a real document from your desk into Claude, ChatGPT and Gemini. Ask each: what is the claim, what is the evidence, what is missing? Mark the errors in red.`,
        resources: [
          {
            type: "VIDEO",
            title: "Transformers, the tech behind LLMs (stop around 12 min)",
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
            title: "Three-assistant red-pen: claim / evidence / missing",
            durationMin: 20,
            note: "Paste a real page from your desk into three assistants. Mark what is wrong in red.",
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
      "Two days of learning, thirty days of practice. One real task a day, about twenty minutes, using the same three assistants all month — so you learn the tools, not the brand of the week.",
    modules: [
      {
        code: "30D",
        title: "30 days of deliberate practice",
        topic: "Putting it to work",
        duration: "30 days",
        summary:
          "One real task a day, ~20 minutes, with the same three assistants all month.",
        body: `One real task a day, about twenty minutes. Use the same three assistants all month.

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
            note: "One task a day · the same three assistants · never forward an unchecked output · a Friday check-in.",
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
async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@learnai.devalier.com";
  const password = process.env.ADMIN_PASSWORD || "changeme123";
  const name = process.env.ADMIN_NAME || "Admin";

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: {
      email,
      name,
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 10),
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
