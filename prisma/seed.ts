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
  /** CORE counts toward the course percentage; REFERENCE and OPTIONAL do not. Left unset, an existing module keeps its tier. */
  tier?: "CORE" | "OPTIONAL" | "REFERENCE";
  resources?: R[];
};

type S = { kicker?: string; title: string; subtitle?: string; modules: M[] };

const sections: S[] = [
  {
    kicker: "Before you start · a weekend · ~2 hours · free",
    title: "Get the vocabulary first",
    subtitle:
      "Do this before Day 1, so the first morning goes on judgement, not definitions. If you only have time for one thing, watch the short language-model video.",
    modules: [
      {
        code: "PRE",
        title: "Build your AI vocabulary before you begin",
        topic: "Foundations: what AI actually is",
        duration: "~2 hrs",
        summary:
          "Seven free videos — from why AI matters to what a model is actually doing and what \"general\" AI would mean. Watch them in order.",
        body: `**Watch order:** the electricity talk → the TED talk → Tina Huang → 3Blue1Brown → the HAI explainer → the AGI podcast.

**Not used here.** No paid enrolments — the Coursera *AI for Everyone*, the DeepLearning.AI *Generative AI for Everyone*, and paid leader certificates are deliberately left out. Everything in this course is free (YouTube and official public pages).`,
        resources: [
          {
            type: "VIDEO",
            title: "AI is the New Electricity",
            author: "Andrew Ng · Stanford GSB",
            url: "https://www.youtube.com/watch?v=21EiKfQYZXc",
            note: "Recorded in 2017: a framing talk about supervised learning and business value, not a current survey of what AI can do.",
          },
          {
            type: "VIDEO",
            title: "How AI Could Empower Any Business (TED)",
            author: "Andrew Ng · TED",
            url: "https://www.youtube.com/watch?v=reUZRyXxUs4",
            note: "Recorded in 2022: the small-data example is a story, not a rule that a handful of examples is enough.",
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
            type: "VIDEO",
            title: "The arrival of AGI",
            author: "Shane Legg & Hannah Fry · Google DeepMind podcast",
            url: "https://www.youtube.com/watch?v=l3u_FAv33G0",
            durationMin: 48,
            note: "What \"general\" means, from the person who coined the term: minimal AGI, full AGI, and how you would test for either.",
          },
          {
            type: "EXERCISE",
            title: "Sort the terms: AI, model, assistant, agent",
            durationMin: 10,
            note: "Five definitions, five examples, an answer key.",
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
        timeSlot: "~2 hrs",
        duration: "2 hrs",
        summary:
          "Learn the mechanism in plain terms, then red-pen three prepared answers about a one-page memo and mark what is wrong.",
        body: `**Learn these first, then treat the videos as clips:**

- **Token ≠ thought** — a token is a chunk of text
- **Next-token prediction is the core mechanism** of a base model; products add training stages, tools and checks around it
- **Training vs inference** — training is the one-off, expensive part that sets the weights; inference is what you pay for on every query
- **Sampling (temperature)** means the same prompt can give different answers, so one run is not a test
- **Hallucination** is plausible-sounding output that is not grounded in fact. It comes from the model completing patterns; training, retrieval and checking reduce it but do not remove it

**Exercise (20 min).** Read a one-page memo, then three answers to: what is the claim, what is the evidence, what is missing? Mark the errors in red. Everything you need is in the worksheet.

**The point:** you can only judge output on a page you know cold. It shows how fluent answers go wrong in small ways, and that answers disagree. Marking errors against fixed criteria is a small eval. The worksheet under Resources walks you through it, with an answer key; no outside service is needed.`,
        resources: [
          {
            type: "VIDEO",
            title: "Intro to Large Language Models",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            note: "Recorded in November 2023. Capabilities, costs and products have moved on since; use it for the ideas, not the numbers.",
            durationMin: 60,
          },
          {
            type: "EXERCISE",
            title: "Red-pen three answers: claim / evidence / missing",
            durationMin: 20,
            note: "Read a short memo and three prepared answers. Mark what is wrong in red.",
          },
          {
            type: "EXERCISE",
            title: "What can the assistant see? Five situations",
            durationMin: 10,
            note: "Where the information was, or why it was missing.",
          },
          {
            type: "EXERCISE",
            title: "Fact, fluency or fabrication? Four outputs",
            durationMin: 10,
            note: "Name the kind of error, and what a good \"I can't tell\" looks like.",
          },
          {
            type: "EXERCISE",
            title: "Which stage built this? Five descriptions",
            durationMin: 10,
            note: "Pretraining, fine-tuning, alignment, the product layer, the transformer.",
          },
        ],
      },
      {
        code: "D1-B",
        title: "Prompt, RAG, fine-tune, or a bigger model",
        topic: "Models and the four levers",
        timeSlot: "~45 min",
        duration: "45 min",
        summary:
          "Four levers. Vendors routinely conflate them — learn when each is the right tool and when it is theatre.",
        body: `**Four levers — vendors conflate them:**

| Lever | What changes | When it is the right tool | When it is theatre |
| --- | --- | --- | --- |
| Better prompt / more context | nothing in the weights | one-off drafting, interrogation | "proprietary prompt library" as a product |
| RAG | documents retrieved at ask-time | corpus changes; you need citations | junk PDFs in a vector DB with no eval; retrieval reduces unsupported answers, it does not remove them |
| Fine-tune | weights | stable style/format at high volume | "train it on all our opinions" with a handful of examples |
| Bigger / newer model | the vendor bill | hard reasoning, messy tools | the default answer to every problem |

The levers combine, and real systems usually use more than one. Fine-tuning is the wrong tool for adding reliable facts.`,
        resources: [
          {
            type: "VIDEO",
            title: "What is Retrieval-Augmented Generation (RAG)?",
            author: "Marina Danilevsky · IBM Technology",
            url: "https://www.youtube.com/watch?v=T-D1OfcDW1M",
            durationMin: 6,
          },
          {
            type: "EXERCISE",
            title: "Closest in meaning: three searches",
            durationMin: 8,
            note: "How search by meaning works, and where it slips.",
          },
          {
            type: "EXERCISE",
            title: "Rewrite the request: context, task, limits, example, check",
            durationMin: 10,
            note: "Rewrite a thin request; compare with a sample.",
          },
          {
            type: "EXERCISE",
            title: "Choose the lever: five situations",
            durationMin: 10,
            note: "Prompt, retrieval, fine-tuning, a tool or a bigger model.",
          },
        ],
      },
      {
        code: "D1-C",
        title: "Agents, autonomy, and why real processes break demos",
        topic: "Autonomy and decision support",
        timeSlot: "~90 min",
        duration: "90 min",
        summary:
          "An agent is a model allowed to call tools in a loop. It tends to fail on undocumented exceptions, messy output, no stop condition, or when a wrong action is costly or hard to undo.",
        body: `**What an agent is.** Usually a model allowed to call tools in a loop — search, write, click, run code, retrieve.

**Where it tends to fail:**

- the process has undocumented exceptions
- the tool output is messy
- there is no stop condition
- a wrong action is costly, legal or hard to undo

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
            type: "EXERCISE",
            title: "Give an assistant actions, and limits",
            durationMin: 12,
            note: "Decide which actions it may take alone, and write a stop condition.",
          },
          {
            type: "EXERCISE",
            title: "A document that gives orders",
            durationMin: 10,
            note: "Prompt injection, jailbreaks and data poisoning, with a harmless example.",
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

The EU AI Act sets rules for certain uses and for providers of general-purpose models (EU only; which duties apply from when is phased, so read the official overview below and note the date you read it). See the next module for copyright and licences.

**Homework.** Tonight, open the worksheet "What not to paste", then pick one real thing you have pasted, or would paste, into an AI tool and answer the four questions about it. No AI tool is needed.`,
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
          {
            type: "EXERCISE",
            title: "What not to paste: five snippets",
            durationMin: 10,
            note: "Personal data and confidentiality, separate from copyright.",
          },
        ],
      },
      {
        code: "D1-E",
        title: "Can I put this into AI?",
        topic: "Responsible and lawful AI: copyright and licences",
        timeSlot: "~45 min",
        duration: "45 min",
        summary:
          "Five different questions hide inside this one: copyright, licence terms, confidentiality, the AI provider's terms and your institution's rules. Passing one does not pass the others.",
        body: `**Five separate questions.**

1. **Copyright law** — may this use be made without asking the rights-holder?
2. **The licence or contract** that came with your access — what did you agree to?
3. **Privacy and confidentiality** — whose information is in it, and may it leave?
4. **The AI provider's terms** — is what you submit kept, reviewed or used for training?
5. **Your institution's rules** — academic integrity, research ethics, IT policy.

Compliance with one settles nothing about the others.

**Four things that feel like permission and are not.**

- A subscription gives you access, not blanket permission to upload or redistribute.
- Attribution says where something came from. It is not permission.
- Non-commercial use or an academic affiliation is not an automatic exception.
- A summary can still reproduce protected expression. A link plus notes in your own words usually does not.

**Three different acts. Do not merge them.** Summarising for your own study. Uploading to a third party's service, where a copy leaves your control. Sharing a result that could stand in for the original. Training a model, reading a document at query time, summarising and redistributing are also different acts, and the law treats them differently.

**Jurisdiction changes the answer.** A general outline, not advice:

- **US:** fair use is a four-factor test applied case by case. There is no list of uses that are safe in advance.
- **UK:** narrow, purpose-specific exceptions (called fair dealing), for example non-commercial research and private study, and quotation, criticism and review; plus a separate exception for text and data analysis for non-commercial research. Whether a particular upload to a chatbot fits one of them is a question to ask, not something to assume.
- **EU:** two text-and-data-mining rules in Directive (EU) 2019/790. Article 3 is for research organisations and cultural heritage institutions doing scientific research on material they have lawful access to. Article 4 is for anyone, but a rights-holder can reserve their rights, for online content in a machine-readable way. Member States implement both, and details differ. Article 3 does not make any AI task by a university lawful: it covers text and data mining for scientific research by organisations that qualify, and does not by itself cover sharing the content or the outputs.

**At a university or research institution.** Check what the library's licence says about AI tools and text mining before anything else. Confirm you reached the material lawfully, through your own access. Treat sending text to an external service as disclosure to a third party. Treat third-party material in your data (images, interviews, personal data) separately. Whether you count as a qualifying research organisation is not for you to decide alone. Ask your subject librarian or research-support or legal office.

**The sequence to work through.**

1. Jurisdiction and purpose
2. Lawful access
3. The licence, and any applicable exception
4. Link, excerpt or full upload
5. Where it is processed and how long it is kept
6. What the output reproduces
7. Audience and redistribution
8. Outcome: permit, restrict, choose an alternative, or seek advice

**Never a bare yes or no.** If the licence, jurisdiction, access route or processing terms are unknown, the honest answer is "more information needed", naming the missing fact, and then a route to your librarian or legal office.

**Status.** Draft of 22 October 2026, general principles for the US, UK and EU. Not yet reviewed by a lawyer or librarian. Primary sources to check before this is treated as validated: 17 U.S.C. section 107; Copyright, Designs and Patents Act 1988 (sections 29, 29A and 30); Directive (EU) 2019/790 Articles 3 and 4 and your country's implementation; and the licence and AI provider terms in front of you. This is education, not legal advice.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Can I put this into AI? Four cases",
            durationMin: 25,
            note: "A fictional publisher's terms and four situations. Decide each one, then open the key.",
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

**What the first two videos are for:** value now comes from handing an agent an outcome and checking the result, not from asking a chatbot for a draft, and an individual's time saved is not a business's value captured until the work around it changes.

**The sentence to leave with:** a demo is not a system. An eval set is.`,
        resources: [
          {
            type: "VIDEO",
            title: "The Agent Shift: Managing AI Like a Team Member",
            author: "Ethan Mollick",
            url: "https://www.youtube.com/watch?v=dTVLDjsXSMQ",
            durationMin: 3,
          },
          {
            type: "VIDEO",
            title: "The AI ROI Problem: Why Individual Productivity Gains Don't Automatically Create Business Value",
            url: "https://www.youtube.com/watch?v=bc5HaDKWEYE",
            durationMin: 3,
          },
          {
            type: "VIDEO",
            title: "Start from the decision, not the model",
            author: "Kuang Xu · Stanford GSB",
            url: "https://www.youtube.com/watch?v=HjRtK0JguBY",
            durationMin: 5,
          },
          {
            type: "VIDEO",
            title: "The AI Productivity Paradox: Why 10X Output Doesn't Mean 10X Business Outcome",
            author: "Mik Kersten",
            url: "https://www.youtube.com/watch?v=NstgZHMU2XY",
            durationMin: 60,
          },
          {
            type: "EXERCISE",
            title: "Which tasks go, which stay? One role, eight tasks",
            durationMin: 10,
            note: "Break a role into tasks and see what the job becomes.",
          },
          {
            type: "EXERCISE",
            title: "Is the data fair to everyone? Four findings",
            durationMin: 10,
            note: "Unrepresentative data, leakage, duplicates and selection bias.",
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
          "A six-question script that fits on one slide. Specific answers are the good sign; a pitch made only of adjectives is the warning.",
        body: `**The six questions.** If they cannot answer these, treat the pitch as unproven:

1. What is the **unit of work**?
2. What is the **eval set** — who labelled it, and what is pass/fail?
3. What is the **human fallback** when it is wrong *and* confident?
4. What is the **cost at 10× volume** — tokens, review hours, rework?
5. What **data leaves the building**, retained how long, and is it trained on?
6. Where did a similar deployment **fail in public**?

Serious teams can usually give specifics. A pitch made only of adjectives is a warning sign. A figure is not proof either: ask where it came from.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Run the six-question script against a real pitch",
            note: "Take a supplier deck or an internal proposal and answer all six. Mark each answer a figure, an adjective or no answer; a figure is something to check, not proof.",
          },
        ],
      },
      {
        code: "D2-C",
        title: "A candidate use for your own unit",
        topic: "Your opportunities",
        timeSlot: "~90 min",
        duration: "90 min",
        summary:
          "Take one workflow and write it up on a single page. Don't pick a winner yet — that is a later decision, made with evidence.",
        body: `For one workflow, write one page:

- The **decision** it supports
- The **data** it needs
- An **eval** — a starter set of real examples (say 20), labelled by a practitioner. It shows you failures; it does not prove reliability
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
        timeSlot: "~30 min",
        duration: "30 min",
        summary:
          "Rewrite the rule from \"no, until we understand it\" to \"yes in a sandbox, with an eval, a named reviewer, and a log\".",
        body: `**Rewrite the implicit rule.**

- **Current:** no, until we understand it.
- **Target:** yes in a sandbox — with an eval, a named reviewer, and a log; production only when the eval holds.

A bare "no" with no path leaves the work where it is, and people may reach for unapproved tools anyway.

A "no" can still be right. Some uses should be refused, or deferred until there is evidence: say why, and say what would change your mind. The worksheet works through one proposal that deserves a conditional yes and one that does not yet.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Approve, refuse, or approve with conditions",
            durationMin: 20,
            note: "An invented council proposal with two uses; write the conditions or the refusal.",
          },
        ],
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

**Iron rule:** do not forward an AI output you have not checked. You are accountable for what you send, edited or not.

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
    title: "Core references",
    subtitle:
      "Watch these once and come back to the clips you need. They are reference material and are not counted in your course percentage.",
    modules: [
      {
        code: "SRC-1",
        tier: "REFERENCE",
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
            title: "Intro to Large Language Models",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
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
    ],
  },
];

const COURSE = {
  slug: "ai-for-decision-makers",
  title: "AI for Decision-Makers",
  subtitle:
    "Understand AI, use it sensibly, spot misleading claims, and explain the essentials. Free. No technical background needed.",
  description:
    "A practical course for people who make decisions and need to judge AI, not just hear about it: two days of grounding, thirty days of practice. Everything required is free and needs no account beyond learnai: videos and official public pages, plus worksheets with worked examples and answer keys. No paid enrolments.",
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
        ...(m.tier ? { tier: m.tier } : {}),
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
      const existing = await prisma.resource.findMany({ where: { moduleId: mod.id }, orderBy: { order: "asc" } });
      // Match by content, not position: a row with the same URL keeps its id (and so its
      // ticks) wherever it moves. URL-less rows (exercises) match in sequence. A row whose
      // URL is gone is replaced, never reused for different content, so a tick on a
      // retired video cannot become a tick on its successor.
      const unclaimed = new Set(existing.map((e) => e.id));
      const urlless = existing.filter((e) => !e.url.trim());
      let nextUrlless = 0;
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
        const match = r.url
          ? existing.find((e) => unclaimed.has(e.id) && e.url.trim() && resourceKey(e.url) === resourceKey(r.url!))
          : urlless[nextUrlless++];
        if (match && unclaimed.has(match.id)) {
          unclaimed.delete(match.id);
          await prisma.resource.update({ where: { id: match.id }, data: resourceData });
        } else {
          await prisma.resource.create({ data: resourceData });
        }
      }
      for (const e of existing.filter((x) => unclaimed.has(x.id))) {
        await prisma.contentMapping.upsert({
          where: { kind_fromKey: { kind: "RESOURCE", fromKey: e.id } },
          update: {},
          create: { kind: "RESOURCE", fromKey: e.id, toKey: null, status: "RETIRED", note: `${e.title} · ${e.url}`.slice(0, 500) },
        });
        await prisma.resource.delete({ where: { id: e.id } });
      }
    }
  }

  // Remove only modules/sections genuinely dropped from the curriculum above.
  const dropped = await prisma.module.findMany({
    where: { section: { courseId: course.id }, code: { notIn: keptModuleCodes } },
    select: { code: true, title: true },
  });
  for (const d of dropped)
    await prisma.contentMapping.upsert({
      where: { kind_fromKey: { kind: "MODULE", fromKey: d.code } },
      update: {},
      create: { kind: "MODULE", fromKey: d.code, toKey: null, status: "RETIRED", note: d.title.slice(0, 500) },
    });
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
    wrong: "Imagined as the machine teaching itself. Every label came from somewhere: people, or an earlier system.",
    defend: "A large share of the commercial value of AI has been one input mapped to one output: email to spam-or-not, claim to fraud-or-not, scan to finding. Name the A and the B in your own case and you can tell inside a minute whether it is a supervised-learning problem at all.",
  },
  {
    slug: "deep-learning", title: "Deep learning", kind: "CONCEPT", region: "machine-learning",
    summary: "Stacked layers that learn their own features instead of being handed them.",
    means: "Many layers of simple units, each learning features from the layer below, so nobody hand-engineers what to look for.",
    wrong: "Used as a synonym for AI, and credited to a conceptual breakthrough.",
    defend: "It is one technique among several, and many of its core ideas are decades old. Data and compute were the main thing that changed, alongside real advances such as the transformer. More scale has kept buying more capability so far — worth knowing, but not a law to plan around.",
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
    means: "A language model generates text by scoring which token could come next and picking one, repeatedly. Assistants add training stages, tools and checks around that core.",
    wrong: "Mistaken for comprehension, because the output reads like it. The same mistake explains why people are surprised it can miscount the letters in a word: it mostly works with fragments, not letters.",
    defend: "Fluency and correctness are different things, which is why they come apart. A base model is trained to produce likely text, and likelihood is not truth. Products add training stages, retrieval and tools that push towards correctness, and these reduce errors without removing them, so the output can still sound right while being wrong.",
  },
  {
    slug: "embeddings", title: "Embeddings", kind: "CONCEPT", region: "language-models",
    summary: "Meaning represented as a position in space.",
    means: "Words, sentences and documents are turned into long lists of numbers, positioned so that related things sit near each other.",
    wrong: "Treated as a storage format, as though the text were in there and could be read back out.",
    defend: "It is a measure of nearness, not a container. That is precisely why search over embeddings finds a document that never uses your words — and why you cannot assume they hold the text, or that they are anonymous either: text can sometimes be partly reconstructed from them.",
  },
  {
    slug: "transformers", title: "Transformers", kind: "CONCEPT", region: "language-models",
    summary: "The architecture that lets a model weigh every part of its input at once.",
    means: "An architecture whose central move, attention, lets each position look at every other position and decide what matters.",
    wrong: "Taken for a brand or a product rather than a design that essentially everyone now uses.",
    defend: "Attention made training parallel, and parallel training made scale affordable. Most models you will be sold are transformers, so the architecture is not where vendors actually differ.",
  },
  {
    slug: "context-window", title: "Context window", kind: "CONSTRAINT", region: "language-models",
    summary: "Everything the model can see on this one call.",
    means: "The fixed budget of text the model can attend to in a single call. Outside it, the model has nothing to go on beyond what training left in its weights.",
    wrong: "Assumed to be memory. People expect last week's conversation to still be in there.",
    defend: "The model itself keeps nothing between calls. A product that appears to remember has stored something and put it back into the window on your behalf. Ask a vendor what goes into the window, who assembles it, and who pays for it.",
  },
  {
    slug: "foundation-models", title: "Foundation models", kind: "CONCEPT", region: "language-models",
    summary: "One general base adapted to many tasks.",
    means: "A single large model trained broadly, then adapted to many downstream uses instead of a new model built per task.",
    wrong: "Read as general competence, so a model that drafts well is assumed to decide well.",
    defend: "What changed is the economics, not the epistemics: adaptation got cheap, which is why many tasks now start from the same base. The breadth of the base says nothing about reliability on your task — that is what evaluation is for.",
  },
  {
    slug: "pretraining", title: "Pretraining", kind: "CONCEPT", region: "language-models",
    summary: "The long, expensive pass that builds the base.",
    means: "The one-off run over a vast corpus that produces the base model. The stages after it are usually much cheaper shaping.",
    wrong: "Confused with fine-tuning, and assumed to be where your own data would go.",
    defend: "Pretrain, then fine-tune, then align: three stages whose costs differ enormously. Most organisations will never pretrain a model. Knowing the stages is how you work out which one a vendor is actually selling you.",
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
    defend: "It is the mechanism working normally. The same next-token machinery that makes a good answer likely makes a wrong answer likely when the right one is out of reach. There is no intent and no reliable internal alarm, which is why grounding and checking are design requirements rather than polish. Good systems reduce hallucination; none removes it.",
  },

  // ── Data ───────────────────────────────────────────────────────────────────
  {
    slug: "data-quality", title: "Data quality", kind: "CONSTRAINT", region: "data",
    summary: "Signal, coverage and labelling set the ceiling.",
    means: "How clean, how representative and how consistently labelled your data is decides the best result any model can reach on it.",
    wrong: "More data is assumed to beat better data.",
    defend: "In the long tail you often have a few hundred examples, not millions, and a small set that is representative and consistently labelled can serve you better than a much larger one that is noisy or labelled inconsistently. How much better depends on the task, so test it on your own data. Usage improves data and better data improves the product, but that loop only turns once labelling is consistent enough to measure.",
  },
  {
    slug: "data-science", title: "Data science", kind: "CONCEPT", region: "data",
    summary: "Insight a person acts on, not a system that acts.",
    means: "Analysis whose output is a conclusion for a human decision, as against a model running inside a process.",
    wrong: "Used interchangeably with machine learning, so work gets staffed and measured as the wrong thing.",
    defend: "The two overlap heavily and share methods, so look at the deliverable. If it is a finding somebody reads and acts on, it is closer to data science; if it is something that runs and decides repeatedly, it is closer to a machine-learning system. The difference matters for staffing and for how each can go wrong, not as a sharp boundary.",
  },

  // ── Applied AI ─────────────────────────────────────────────────────────────
  {
    slug: "prompting", title: "Prompting", kind: "CONCEPT", region: "applied-ai",
    summary: "The first lever, and usually the cheapest.",
    means: "Changing what you put into the context in order to change what comes out, with no change to the model.",
    wrong: "Dismissed as a trick, or inflated into a profession.",
    defend: "It needs no training and little infrastructure, so it is where you find out whether the task is feasible at all. Reach past it before trying it and you buy a training run to fix a wording problem.",
  },
  {
    slug: "rag", title: "RAG", kind: "CONCEPT", region: "applied-ai",
    summary: "Retrieve your own documents, then answer from them.",
    means: "Fetch the relevant passages from your corpus and put them in the context, so the answer can draw on them.",
    wrong: "Believed to teach the model your documents.",
    defend: "Nothing is learned; passages are pasted in at answer time. That is the advantage — change a document and the next answer changes — and it is also the limit: if retrieval misses the right passage, the model may answer anyway, and it can still misread the passages it was given.",
  },
  {
    slug: "fine-tuning", title: "Fine-tuning", kind: "DECISION", region: "applied-ai",
    summary: "Changes behaviour, not what it knows.",
    means: "Further training on your own examples to shift format, tone and how the model approaches a task.",
    wrong: "Reached for to make a model \"know our business\".",
    defend: "It shifts behaviour more reliably than it adds facts, and it freezes whatever it learned on the day it ran. For current, specific knowledge you want retrieval; for a consistent shape of output you want fine-tuning.",
  },
  {
    slug: "agents", title: "Agents", kind: "CONCEPT", region: "applied-ai",
    summary: "A model acting in a loop, not just answering.",
    means: "A model that acts, observes the result, and acts again until the task is done or it gives up.",
    wrong: "Treated as a smarter model. It is the same model, in a loop.",
    defend: "The capability gain comes largely from the loop and the tools, not from the model getting cleverer — which is why the hard questions are all about the loop: what it can touch, how it knows it is finished, and what happens on step nine of ten.",
  },
  {
    slug: "tool-use", title: "Tool use", kind: "CONCEPT", region: "applied-ai",
    summary: "Letting the model call things that actually work.",
    means: "Giving the model functions it can call — search, a database, code, an API — with results coming back into its context.",
    wrong: "Thought to make the model reliable, because the arithmetic now comes out right.",
    defend: "It fixes what tools are good at and moves the risk rather than removing it: the model still chooses when to call, with what arguments, and whether to believe what comes back. A model with tools can fail in new ways, and tools alone do not make it reliable.",
  },
  {
    slug: "autonomy", title: "Autonomy", kind: "DECISION", region: "applied-ai",
    summary: "A dial, and it sets your blast radius.",
    means: "How far the system may act without a human in the path — a range of settings, not a yes or a no.",
    wrong: "Posed as a switch: either a human approves everything or the thing runs itself.",
    defend: "Every notch up tends to raise the value and the cost of being wrong at the same time. The design question is never \"autonomous or not\" but which step a human sits on, and what it costs to be wrong at that step.",
  },
  {
    slug: "evaluation", title: "Evaluation", kind: "CONCEPT", region: "applied-ai",
    summary: "Without it you cannot tell a change from an improvement.",
    means: "A set of representative cases, each with a way to judge the outcome, run against every change, so you can see whether the change actually helped.",
    wrong: "Substituted with a demo, or with a vendor's benchmark score.",
    defend: "Measure how the current process performs first, or you have no baseline to beat. Vibes move with whoever ran the demo; cases do not. An unmeasured baseline is how a project comes to report a lift it never had. Keep the set representative and refresh it, or it goes stale.",
  },
  {
    slug: "prompt-injection", title: "Prompt injection", kind: "CONSTRAINT", region: "applied-ai",
    summary: "Text the model reads can redirect it.",
    means: "Content the model ingests — a page, a document, an email — carries instructions, and the model has no reliable way to tell those from yours.",
    wrong: "Filed as a jailbreak problem, i.e. as being about users misbehaving.",
    defend: "It is a data-trust problem, not a user problem: anything the model reads becomes a possible instruction. That is why it gets sharply worse with tools and autonomy, and why the main mitigation is limiting what the system can do, with layered defences, rather than wording things better. No single defence is reliable alone.",
  },

  // ── Law & governance ───────────────────────────────────────────────────────
  {
    slug: "eu-ai-act", title: "EU AI Act", kind: "CONSTRAINT", region: "law-governance",
    summary: "Duties follow the use, and also fall on the provider of the model.",
    means: "An EU regime with two layers: a tiered set of duties for uses (prohibited, high-risk, transparency duties, minimal) and separate obligations on the providers of general-purpose AI models.",
    wrong: "Read as a ban on AI, as applying only to the use, or as applying only to the model you bought.",
    defend: "For a deployment the first questions are which tier your use sits in and what your role is: provider, deployer or both. The same model can sit in different tiers depending on the use. The model's own provider carries separate duties for the model itself; you can ask about them but cannot assume them. Which duties apply, and from when, is phased and has been subject to amendment, so check the Commission's current page and note the date before relying on any deadline.",
  },
  {
    slug: "gdpr", title: "GDPR", kind: "CONSTRAINT", region: "law-governance",
    summary: "Still applies, in full, already.",
    means: "Where personal data is processed and the GDPR applies, lawful basis, purpose limitation, minimisation and data-subject rights apply to an AI system as they do anywhere else.",
    wrong: "Assumed to be superseded or somehow suspended by the AI Act.",
    defend: "The AI Act adds duties; it removes none. In practice GDPR is often the obligation that bites first and the one you already have the machinery for, which makes it a sensible place to start.",
  },
  {
    slug: "human-oversight", title: "Human oversight", kind: "DECISION", region: "law-governance",
    summary: "Real only if the person can actually intervene.",
    means: "Someone positioned to understand the output and able to stop, change or override it inside the live process.",
    wrong: "Satisfied with an approval click, which records a decision nobody had the time or the information to make.",
    defend: "Oversight is tested by whether the person sees enough, has the time and has the authority to say no without penalty. A reviewer who never overrides is a warning sign, not proof; look at what they can see, how long they have and what happens when they refuse. A sign-off step is not oversight, and that is the distinction oversight rules, such as the EU AI Act's for high-risk systems, are aiming at.",
  },
  {
    slug: "copyright-licensing", title: "Copyright and licensing", kind: "CONSTRAINT", region: "law-governance",
    summary: "Access, permission and processing are separate questions.",
    means: "Whether you may put someone else's material into an AI tool depends on copyright law, the licence or contract you accepted, confidentiality, the provider's processing terms and your institution's rules, in the jurisdiction that applies.",
    wrong: "Treated as one yes-or-no question, usually settled by \"I have a subscription\", \"I credit the source\" or \"it is for research\".",
    defend: "Answer the five questions separately, and in order: jurisdiction and purpose, lawful access, licence and exceptions, what is uploaded, where it goes, what comes out, who sees it. If a fact is missing, say which one and ask your librarian or legal office, rather than guessing in either direction.",
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
  ["copyright-licensing", "gdpr", "ADJACENT"],
  ["copyright-licensing", "human-oversight", "ADJACENT"],
  ["copyright-licensing", "foundation-models", "ADJACENT"],
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
const LLM_BRIEFLY = "https://www.youtube.com/watch?v=LPZh9BOjkQs";
const FM_EXPLAINER = "https://www.youtube.com/watch?v=kK3NmQT241w";
const INTRO_LLM = "https://www.youtube.com/watch?v=zjkBMFhNj_g";
const AI_ACT = "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai";
const AGENT_SHIFT = "https://www.youtube.com/watch?v=dTVLDjsXSMQ";
const ROI_PROBLEM = "https://www.youtube.com/watch?v=bc5HaDKWEYE";
const PRODUCTIVITY_PARADOX = "https://www.youtube.com/watch?v=NstgZHMU2XY";
const LEGG_AGI = "https://www.youtube.com/watch?v=l3u_FAv33G0";
const DECISION_FIRST = "https://www.youtube.com/watch?v=HjRtK0JguBY";
const T_TERMS = "Sort the terms: AI, model, assistant, agent";
const T_CONTEXT = "What can the assistant see? Five situations";
const T_FABRICATION = "Fact, fluency or fabrication? Four outputs";
const T_STAGES = "Which stage built this? Five descriptions";
const T_EMBEDDINGS = "Closest in meaning: three searches";
const T_PROMPTING = "Rewrite the request: context, task, limits, example, check";
const T_LEVERS = "Choose the lever: five situations";
const T_ACTIONS = "Give an assistant actions, and limits";
const T_INJECTION = "A document that gives orders";
const T_PASTE = "What not to paste: five snippets";
const T_TASKS = "Which tasks go, which stay? One role, eight tasks";
const T_DATA = "Is the data fair to everyone? Four findings";
const T_CONDITIONS = "Approve, refuse, or approve with conditions";
const PUT_IN_AI = "Can I put this into AI? Four cases";
const RED_PEN = "Red-pen three answers: claim / evidence / missing";
const UNIT_OF_WORK = "Name the unit of work";
const SIX_QUESTIONS = "Run the six-question script against a real pitch";
const ONE_PAGER = "One page per candidate use";

const IBM_RAG = "https://www.youtube.com/watch?v=T-D1OfcDW1M";
const EFFECTIVE_AGENTS = "https://www.youtube.com/watch?v=D7_ipDqhtwk";
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

  // ── Tina Huang · Generative AI for Everyone in 25 minutes ────────────────
  // A speed-run of Ng's three-week course. Rows follow the course's syllabus;
  // a 25-minute cut gives each topic a minute or two, so only what the course
  // works in examples is above MENTIONS.

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

  // ── 3Blue1Brown · Transformers, the tech behind LLMs (DL ch. 5, 27 min) ───
  // Attention itself is chapter 6, a different video; this one is the overview.

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
  [RED_PEN, "evaluation", "DEFINES", "Judging output against fixed criteria, by hand: a small evaluation.", 0.8],

  // ── 9 AI Concepts Explained in 7 minutes ─────────────────────────────────
  // Full title: "AI Agents, RAGs, Tokenization, RLHF, Diffusion, LoRA…". Under
  // a minute per concept: enough to name each one in context, not to define it.

  // ── Unit-of-work exercise (D1-C) ─────────────────────────────────────────
  [UNIT_OF_WORK, "automation", "DEMONSTRATES", "The exercise is task decomposition on a real process.", 0.9],
  [UNIT_OF_WORK, "autonomy", "DEMONSTRATES", "Deciding which step keeps a human on it.", 0.75],
  [UNIT_OF_WORK, "human-oversight", "DEMONSTRATES", "Naming the human fallback, and what a confident error costs.", 0.75],

  // ── EU AI Act · official overview (European Commission) ──────────────────
  // ── In-app concept worksheets: original material with an answer key (src/lib/exercises-concepts.ts) ──
  [T_TERMS, "foundation-models", "DEMONSTRATES", "Model, assistant and agent told apart with five examples.", 0.8],
  [T_TERMS, "agents", "DEMONSTRATES", "An agent as an assistant allowed to act, in a worked example.", 0.7],
  [T_TERMS, "supervised-learning", "DEMONSTRATES", "A spam filter learned from labelled examples, sorted against rule-based AI.", 0.7],
  [T_CONTEXT, "context-window", "DEFINES", "What is and is not in front of the model on a call, in five situations.", 0.85],
  [T_FABRICATION, "hallucination", "DEFINES", "Fabricated detail, wrong summary, unsupported inference, and a sound abstention.", 0.85],
  [T_STAGES, "pretraining", "DEFINES", "The pretraining stage and what it does and does not give.", 0.8],
  [T_STAGES, "alignment", "DEFINES", "Feedback-based post-training, and that it shapes behaviour statistically.", 0.8],
  [T_STAGES, "transformers", "DEFINES", "The design that lets each part of the text weigh the others, kept apart from the stages.", 0.75],
  [T_STAGES, "next-token-prediction", "DEMONSTRATES", "The pretraining objective, in the lifecycle.", 0.6],
  [T_STAGES, "fine-tuning", "DEMONSTRATES", "Fine-tuning as a stage, against prompt-level changes.", 0.7],
  [T_EMBEDDINGS, "embeddings", "DEFINES", "Meaning as position, with a case where closeness misleads.", 0.85],
  [T_EMBEDDINGS, "rag", "DEMONSTRATES", "Search by meaning, the retrieval half of RAG.", 0.6],
  [T_PROMPTING, "prompting", "DEFINES", "Context, task, limits, example and check, worked on a thin request.", 0.85],
  [T_LEVERS, "prompting", "DEMONSTRATES", "The prompt as the cheapest lever.", 0.7],
  [T_LEVERS, "rag", "DEMONSTRATES", "When retrieval is the right lever.", 0.8],
  [T_LEVERS, "fine-tuning", "DEFINES", "When fine-tuning fits (stable format at volume) and when it does not.", 0.8],
  [T_LEVERS, "tool-use", "DEMONSTRATES", "A calculator or database where the model does arithmetic badly.", 0.7],
  [T_ACTIONS, "agents", "DEFINES", "An agent as a model with permissions to act, worked on a booking scenario.", 0.85],
  [T_ACTIONS, "tool-use", "DEFINES", "Each action is a tool the model may call, with different risks.", 0.75],
  [T_ACTIONS, "autonomy", "DEFINES", "Freedom per action as a dial set by reversibility and cost.", 0.85],
  [T_ACTIONS, "human-oversight", "DEFINES", "What makes an approval step real: information, time and authority.", 0.8],
  [T_INJECTION, "prompt-injection", "DEFINES", "Instructions hidden in content, told apart from jailbreaks and data poisoning.", 0.85],
  [T_INJECTION, "tool-use", "MENTIONS", "Permissions decide how much an injection can do.", 0.5],
  [T_PASTE, "gdpr", "DEFINES", "Personal data, minimisation, retention and provider terms, on five snippets.", 0.75],
  [T_PASTE, "copyright-licensing", "MENTIONS", "Confidentiality and personal data as questions separate from copyright.", 0.4],
  [T_TASKS, "automation", "DEFINES", "A role broken into tasks, each automated, assisted or kept, and what the job becomes.", 0.85],
  [T_DATA, "data-quality", "DEFINES", "Representativeness, duplicates, leakage and selection bias in one data summary.", 0.85],
  [T_DATA, "evaluation", "MENTIONS", "A good test score can hide leakage.", 0.5],
  [T_CONDITIONS, "human-oversight", "DEMONSTRATES", "Named reviewer, monitoring and stop conditions in a worked case.", 0.75],
  [T_CONDITIONS, "autonomy", "DEMONSTRATES", "Approve with conditions or refuse, by what a mistake would cost.", 0.6],
  [T_CONDITIONS, "gdpr", "MENTIONS", "Personal data as a reason to refuse a use.", 0.4],
  [PUT_IN_AI, "copyright-licensing", "DEFINES", "Four worked cases against a fictional publisher's terms, ending in a permit / restrict / alternative / advice / more-information decision.", 0.85],
  [PUT_IN_AI, "gdpr", "MENTIONS", "Confidentiality and personal data are one of the five separate questions.", 0.4],
  [AI_ACT, "eu-ai-act", "DEFINES", "The official risk tiers, from the source.", 0.9],
  [AI_ACT, "human-oversight", "MENTIONS", "One line in the list of high-risk obligations.", 0.75],
  [AI_ACT, "foundation-models", "MENTIONS", "General-purpose AI models and their transparency and systemic-risk duties.", 0.7],
  [AI_ACT, "data-quality", "MENTIONS", "High-quality datasets as a high-risk obligation.", 0.7],
  [AI_ACT, "gdpr", "MENTIONS", "Data protection, at most in passing; the CNIL guidance (D1-D) is where GDPR is taught.", 0.4],

  // ── Evaluation (D2-A, SRC-1) ─────────────────────────────────────────────
  // Value extraction (D2-A). MENTIONS only and unreviewed: mapped from the title, not a
  // transcript, so ticking them grants no ground until an editor reviews them.
  [AGENT_SHIFT, "agents", "MENTIONS", "Unreviewed: placed from the title (managing AI like a team member).", 0.3],
  [AGENT_SHIFT, "autonomy", "MENTIONS", "Unreviewed: placed from the title.", 0.3],
  [ROI_PROBLEM, "automation", "MENTIONS", "Unreviewed: placed from the title (individual gains vs business value).", 0.3],
  [PRODUCTIVITY_PARADOX, "evaluation", "MENTIONS", "Unreviewed: placed from the title (output vs business outcome).", 0.3],
  [PRODUCTIVITY_PARADOX, "automation", "MENTIONS", "Unreviewed: placed from the title.", 0.3],

  // ── Kuang Xu · Class Takeaways, Data Science and AI Strategy (5 min) ──────
  [LEGG_AGI, "agi", "DEFINES", "Minimal AGI as the range of a typical person's cognitive abilities; full AGI and beyond; how you would test for it.", 0.7],
  [LEGG_AGI, "automation", "MENTIONS", "What AGI would do to work.", 0.5],
  [DECISION_FIRST, "data-science", "DEFINES", "The two pillars: analytics a person acts on, against automated decisions built into a product.", 0.75],
  [DECISION_FIRST, "automation", "MENTIONS", "Automated decision-making as one pillar; tasks are not decomposed.", 0.6],
  [DECISION_FIRST, "data-quality", "MENTIONS", "Data on its own is often not a moat.", 0.6],

  // ── Andrej Karpathy · State of GPT (Microsoft Build, 2023) ───────────────

  // ── Andrej Karpathy · Let's build GPT from scratch (SRC-2) ───────────────

  // ── Stanford HAI · Foundation Models workshop (playlist) ─────────────────

  // ── Vendor script and one-pager (D2-B, D2-C) ─────────────────────────────
  [SIX_QUESTIONS, "evaluation", "DEMONSTRATES", "Question 2: what is the eval set, who labelled it, what is pass/fail.", 0.75],
  [SIX_QUESTIONS, "human-oversight", "DEMONSTRATES", "Question 3: the human fallback when it is wrong and confident.", 0.7],
  [SIX_QUESTIONS, "gdpr", "MENTIONS", "Question 5: what data leaves the building and whether it is trained on.", 0.6],
  [ONE_PAGER, "evaluation", "DEMONSTRATES", "Twenty real examples, labelled by a practitioner, with a kill criterion.", 0.75],

  // ── Added to fill the nodes nothing in The List taught ───────────────────
  [IBM_RAG, "rag", "DEFINES", "Add a content store, retrieve first, answer from it, cite it — and say \"I don't know\" when retrieval comes back empty.", 0.85],
  [IBM_RAG, "hallucination", "DEMONSTRATES", "The out-of-date confident answer RAG exists to correct.", 0.7],
  [EFFECTIVE_AGENTS, "agents", "DEFINES", "An agent is a model using tools in a loop, choosing its own path; a workflow is a fixed path.", 0.8],
  [EFFECTIVE_AGENTS, "autonomy", "DEFINES", "Don't build an agent for everything: complexity, value, de-risked capabilities, and whether errors are easy to catch.", 0.75],
  [EFFECTIVE_AGENTS, "tool-use", "MENTIONS", "Tools as what the loop acts through.", 0.7],
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
    where: { slug: { notIn: keptSlugs }, retiredAt: null, origin: { notIn: ["COMMUNITY", "ADMIN"] } },
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
