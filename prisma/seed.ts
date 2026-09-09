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
    kicker: "Before you start · a weekend · about 3 hours · free",
    title: "Get the vocabulary first",
    subtitle:
      "Do this before Day 1, or you'll spend the first morning on definitions instead of judgement. If you only have time for one thing, watch the short language-model video. Then stop collecting courses and begin.",
    modules: [
      {
        code: "PRE",
        title: "Build your AI vocabulary before you begin",
        topic: "Foundations: what AI actually is",
        duration: "~3 hrs",
        summary:
          "Three inputs. The first two are gentle overviews — you don't need the certificates. The third is the real literacy layer in eight minutes.",
        body: `**Why this matters.** Most people arrive fluent in the vocabulary of press releases and empty on how the technology works. These three inputs close that gap so the rest of the course can build judgement, not define terms.

**If you are short on time,** watch the eight-minute language-model video. That alone is the literacy layer. Once you have done these three, stop looking for more introductions — further browsing is procrastination, not preparation.`,
        resources: [
          {
            type: "COURSE",
            title: "AI for Everyone (audit — you don't need the certificate)",
            author: "Andrew Ng · Coursera",
            url: "https://www.coursera.org/learn/ai-for-everyone",
          },
          {
            type: "COURSE",
            title: "Generative AI for Everyone — Week 1 only (~30 min of video)",
            author: "Andrew Ng · DeepLearning.AI",
            url: "https://www.deeplearning.ai/courses/generative-ai-for-everyone/",
            durationMin: 30,
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
        ],
      },
    ],
  },
  {
    kicker: "Day 1 · How the technology actually works",
    title: "Enough mechanism to judge the tools, not just use them",
    subtitle:
      "The videos are short clips, not the lesson — the work is in reading, trying, and questioning. Keep one principle in mind: the goal is to stop being a passive audience for demos and start being able to test a claim yourself.",
    modules: [
      {
        code: "D1-A",
        title: "What the machine actually does",
        topic: "Foundations: how a language model works",
        timeSlot: "~90 min",
        duration: "90 min",
        summary:
          "Learn the mechanism in plain terms, then run one real document through two or three assistants and mark, in red, what is wrong.",
        body: `**Learn these, in order:**

- **Token** — a chunk of text, not a "thought"
- **Next-token prediction** — the whole trick: the model predicts the most likely next chunk, over and over
- **Training** (done once, expensive, changes the model's weights) vs **inference** (every time you ask, and you pay per token of text)
- **Temperature / sampling** — why the same prompt does not give the same answer twice, so it is not a laboratory method
- **Hallucination** — not a bug in the usual sense: the model completes a plausible pattern even when it has nothing to ground it on

**Watch (pick one).** The short transformer explainer is enough for most; stop around the 12-minute mark if the detail stops helping. The hour-long talk is a deeper, optional companion — its first ~18 minutes cover inference, training and the assistant "fine-tune".

**Try it (20 minutes).** Take the first page of a real note, opinion, mandate or email you wrote last week. Paste it into two or three assistants (for example ChatGPT, Claude, Gemini) and ask each: *what is the claim, what is the evidence, and what is missing?* Mark what is wrong in red. That comparison — not the videos — is the lesson.`,
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
            title: "Intro to Large Language Models (optional deeper companion)",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
            note: "First ~18 minutes cover inference, training and the assistant fine-tune. Reused on Day 1 afternoon for tool use and security.",
          },
          {
            type: "EXERCISE",
            title: "Three-assistant red-pen: claim / evidence / missing",
            durationMin: 20,
            note: "Paste a real page you wrote into two or three assistants. Mark what is wrong in red.",
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
          "Four levers that vendors routinely conflate. Learn when each is the right tool and when it is just for show.",
        body: `**Four levers — and where each becomes theatre:**

| Lever | What it changes | The right tool when | Just for show when |
| --- | --- | --- | --- |
| Better prompt / more context | nothing inside the model | one-off drafting, interrogating a document | "our proprietary prompt library" sold as a product |
| RAG (retrieval) | documents fetched at the moment you ask | your material changes often; you need citations | random PDFs in a database with no test of quality |
| Fine-tune | the model's weights | a stable style or format at high volume | "train it on all our opinions" with 40 examples |
| Bigger / newer model | mainly the bill | genuinely hard reasoning, messy tools | the default answer to every problem |

**A worked example.** Finding the relevant passage in a recent opinion is a *retrieval* problem. A house style for draft minutes is a good prompt with examples, or a light fine-tune. Do not fine-tune a model to "know toxicology" — that is not what fine-tuning does, and it will invent confidently.`,
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
          "An agent is a model allowed to use tools in a loop. It fails on undocumented exceptions, messy inputs, no stopping rule, or when a wrong action carries legal weight.",
        body: `**What an agent is.** A model allowed to use tools in a loop — search, write, click, run code, retrieve.

**Where it fails:**

- the process has undocumented exceptions that a human handles from experience
- the inputs it must read are messy or inconsistent
- there is no clear stopping rule
- the cost of a confident wrong action is legal or reputational

**Try it.** Take one process in your unit that looks automatable — a literature screen, a dossier completeness check, meeting minutes, an outbreak-cluster narrative. Write down three things: the **unit of work**, the **human fallback** when it goes wrong, and **what happens if it is confidently wrong**. Most people find they cannot name the unit of work cleanly. That difficulty is the point — it tells you where automation is not yet safe.`,
        resources: [
          {
            type: "VIDEO",
            title: "Intro to LLMs — tool use (from ~27 min) and security (from ~46 min)",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
            note: "Same talk as the morning. The security section covers jailbreaks, prompt injection and data poisoning — the failure modes that matter for public-sector use.",
          },
          {
            type: "EXERCISE",
            title: "Name the unit of work",
            note: "One process that looks automatable → unit of work / human fallback / cost of a confident error.",
          },
        ],
      },
      {
        code: "D1-D",
        title: "Risk you can already govern — and the EU rules that apply",
        topic: "Responsible and lawful AI",
        timeSlot: "~60 min",
        duration: "60 min",
        summary:
          "Four risk buckets you already know how to run, mapped onto the obligations a European public authority now carries under the EU AI Act and data-protection law.",
        body: `**Four buckets you already manage — apply them to AI:**

- **Confidentiality & data protection.** Does the text leave the building? Never paste personal data or commercially confidential dossier content into a consumer AI tool. Under the GDPR (and the EU institutions' Regulation 2018/1725) that is a processing decision with a lawful basis and a controller — treat it as one, and use only an approved, appropriately contracted tenancy.
- **Integrity of the scientific record.** Can an AI-assisted draft become a finished output without a named human reviewer? If not, say so in the process.
- **Workforce.** Who is deskilled and who is amplified? Name it early rather than discovering it later.
- **Liability & the public voice.** If it speaks to the public, it is the organisation speaking. The Air Canada case — where a court held the organisation to what its chatbot told a customer — is the one example worth remembering.

**The EU AI Act, in orientation (confirm specifics with your legal service and DPO).** The Act is risk-based: some uses are prohibited, some are "high-risk" and carry strict obligations, some need only transparency, and the rest are largely unregulated. General-purpose models — the assistants you will use — have their own obligations, and when your organisation *deploys* such a system it takes on duties too: human oversight, logging, transparency to the people affected, and, for public authorities using high-risk AI, a fundamental-rights impact assessment. The obligations are being phased in through 2025–2027. The practical point for you: decide which risk tier a use falls into *before* you build, and bring legal and your DPO in as designers of the path, not as a final gate.`,
        resources: [
          {
            type: "ARTICLE",
            title: "EU AI Act — official overview of the regulatory framework",
            author: "European Commission",
            url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
            note: "The authoritative starting point on risk tiers and obligations. Read alongside your own legal service's guidance.",
          },
        ],
      },
    ],
  },
  {
    kicker: "Day 2 · Turning it into decisions",
    title: "From how it works to where it pays off",
    subtitle:
      "Start by looking again at yesterday's document exercise: the tool was fast and uneven. Both halves of that sentence matter for the decisions that follow.",
    modules: [
      {
        code: "D2-A",
        title: "How value actually appears",
        topic: "Where AI creates value",
        timeSlot: "~90 min",
        duration: "90 min",
        summary:
          "Five workflow shapes. For each, name the hours saved, the failure mode, who owns the clean-up, and whether the data may leave the tenant. One sentence to keep: a demo is not a system — an evaluation set is.",
        body: `**Five workflow shapes** (fill each with examples from your own unit):

1. **Draft, rewrite, translate** — minutes, letters, web copy, working across the EU languages
2. **Interrogate a pack** — a dossier, mandate, contract or vendor deck you did not write
3. **Map the evidence** — a literature or evidence map, using retrieval rather than guesswork
4. **Assist surveillance** — a cluster narrative *after* the analytical pipeline, not instead of it
5. **Support a meeting or decision** — an agenda, the open questions, and explicitly what is *not* yet decided

For each, write down four things: **expected hours saved · the failure mode · who owns the clean-up · whether the data may leave the tenant.**

**The one sentence to leave with:** a demo is not a system. An evaluation set — a fixed set of real examples with known right answers, that you can re-run — is.`,
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
            title: "Evaluations, in depth (optional, if you want the practitioner view)",
            author: "Lenny's Podcast · Husain & Shreya Shankar",
            url: "https://www.youtube.com/watch?v=BsWxPI9UM4c",
            note: "A longer alternative to the clip above.",
          },
          {
            type: "VIDEO",
            title: "Data Science & AI Strategy — start from the decision, not the model",
            author: "Kuang Xu · Stanford GSB",
            url: "https://www.youtube.com/watch?v=HjRtK0JguBY",
            durationMin: 5,
            note: "A five-minute framing: AI is not a monolith — begin from the decision you need to support.",
          },
        ],
      },
      {
        code: "D2-B",
        title: "How to question a vendor — and your own IT",
        topic: "Buying and building",
        timeSlot: "~45 min",
        duration: "45 min",
        summary:
          "A six-question script that fits on one slide. Serious suppliers answer with numbers; \"transformative\" is the tell that they cannot.",
        body: `**The six questions.** If a supplier — or an internal team — cannot answer these, they are selling a deck, not a system:

1. What is the **unit of work**?
2. What is the **evaluation set** — who labelled it, and what counts as pass or fail?
3. What is the **human fallback** when the system is wrong *and* confident?
4. What is the **cost at ten times the volume** — tokens, review hours, rework?
5. What **data leaves the building**, retained for how long, and is it used to train the model? (For a European authority this is a GDPR and procurement question, not a technicality.)
6. Where has a similar deployment **failed in public**?

Serious teams have numbers. "Transformative" and "revolutionary" are the words that fill the space where numbers should be. Bring procurement and your DPO in early — the contract, not the demo, is where data-protection and exit terms are won or lost.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Run the six-question script against a real pitch",
            note: "Take a supplier deck or an internal proposal and answer all six from it. Score: numbers vs adjectives.",
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
          "Take one workflow from the morning and write it up on a single page. Don't pick a winner yet — that is a later decision, made with evidence.",
        body: `**Write one page for one workflow from the morning list:**

- The **decision** it supports
- The **data** it needs
- An **evaluation** — 20 real examples, labelled by a scientist, not by a vendor
- The **owner**
- A **kill criterion** — what result within 30 days would tell you to stop
- What **legal, cyber and data protection must enable** (not simply forbid)

Keep several candidates alive at this stage. Forcing the choice too early is how good options get discarded before they are tested.`,
        resources: [
          {
            type: "EXERCISE",
            title: "One page per candidate use",
            note: "Decision · data · evaluation (20 labelled examples) · owner · kill criterion · what must be enabled.",
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
          "Rewrite the default rule from \"no, until we fully understand it\" to \"yes in a sandbox, with an evaluation, a named reviewer, and a log — production only when the evaluation holds\".",
        body: `**Rewrite the default rule.**

- **Today, often:** "No, until we fully understand it."
- **Better:** "Yes in a sandbox — with an evaluation, a named reviewer, and a log. Move to production only when the evaluation holds and the risk tier and lawful basis are clear."

Cyber, legal and data protection belong at the table as **designers of that path**. If their only available answer is "no", they are effectively deciding that the organisation stays analog — and that is a decision with its own risks. Name it, and give them a route to "yes, safely".`,
        resources: [],
      },
    ],
  },
  {
    kicker: "After the two days · 30 days of practice",
    title: "The 30-day practice plan",
    subtitle:
      "Two days of learning, thirty days of practice. One real task a day, twenty minutes, using the same two or three tools all month — so you learn the tools themselves, not the brand of the week.",
    modules: [
      {
        code: "30D",
        title: "30 days of deliberate practice",
        topic: "Putting it to work",
        duration: "30 days",
        summary:
          "One real task a day. The same tools all month. One rule you never break: don't forward an AI output you haven't checked and edited yourself.",
        body: `**One real task a day, about twenty minutes. Use the same two or three tools all month** — the aim is to learn the tools, not to chase new brands.

| Week | Your daily task |
| --- | --- |
| 1 | Draft or rewrite something you would have written anyway — an email, a minute, a note |
| 2 | Interrogate a document you did **not** write — a contract clause, a vendor slide, a draft page |
| 3 | Summarise a pack, then list what the summary **cannot** safely be used for |
| 4 | Challenge an AI output from a colleague or a supplier, and write down the failure mode |

**The one rule.** Never forward an AI output you have not read and edited. If you forward it unedited, you own the error — treat it as your own words, because to everyone else it is.

**A weekly check-in.** Once a week, take one thing that worked and one that didn't to your AI guide — the assistant you're practising with — and ask it to help you understand *why* the weak one failed. Spending twenty minutes there each week is the point. Being behind on the names of new models does not matter. Being unable to spot a fluent, wrong paragraph does.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Commit to the 30-day plan",
            note: "One task a day · the same two or three tools · never forward an unchecked output · a weekly check-in with your AI guide.",
          },
        ],
      },
    ],
  },
  {
    kicker: "Reference · keep these, don't binge them",
    title: "Core references and optional deep dives",
    subtitle:
      "Watch these once and come back to the clips you need. The deep dives are for anyone on the technical side — take a clip, don't feel you must watch the long sessions.",
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
            title: "State of GPT — how a model is trained (pretrain → fine-tune → alignment)",
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
            title: "Data Science & AI Strategy — start from the decision, not the model",
            author: "Kuang Xu · Stanford GSB",
            url: "https://www.youtube.com/watch?v=HjRtK0JguBY",
            durationMin: 5,
          },
          {
            type: "ARTICLE",
            title: "EU AI Act — official overview of the regulatory framework",
            author: "European Commission",
            url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
            note: "The authoritative reference for the obligations that apply to a European public authority.",
          },
        ],
      },
      {
        code: "SRC-2",
        title: "Optional deep dive — for the technical side",
        topic: "Reference",
        summary: "Not needed for the decision-maker track. Useful if someone on your team wants to see under the hood.",
        resources: [
          {
            type: "VIDEO",
            title: "Let's build GPT from scratch",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
            note: "Only if someone on the technical side asks for it.",
          },
          {
            type: "VIDEO",
            title: "Foundation Models workshop (playlist)",
            author: "Stanford HAI",
            url: "https://www.youtube.com/playlist?list=PLYLBSCrrqNXz1RQCVwv7mApexCcn7Bybk",
            note: "Free and in-depth. Take a clip rather than assigning the full multi-hour sessions.",
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
    "Learn how AI really works, then apply it to strategy and decisions — two days of grounding, thirty days of practice, built for public administration.",
  description:
    "A practical course for people who make decisions in the public sector and need to judge AI, not just hear about it. It skips the hype and concentrates on the two things the job actually needs: honest evaluation of what these tools do, and the reality that they meet in existing, imperfect processes.",
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
