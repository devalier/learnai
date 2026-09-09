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
  stanfordWeek?: string;
  timeSlot?: string;
  duration?: string;
  summary?: string;
  body?: string;
  resources?: R[];
};

type S = { kicker?: string; title: string; subtitle?: string; modules: M[] };

const sections: S[] = [
  {
    kicker: "Pre-work · weekend · ~3 hours · free",
    title: "Literacy layer",
    subtitle:
      "Do this before Day 1 or the morning is wasted on vocabulary. If someone has no time, they watch items 3 and 4 on the train. Stop collecting courses after this.",
    modules: [
      {
        code: "PRE",
        title: "Build the vocabulary before the room",
        stanfordWeek: "Pre-work",
        duration: "~3 hrs",
        summary:
          "Four inputs. The first two are audits — skip the certificates. The last two are the true literacy layer.",
        body: `**Why this exists.** People arrive fluent in slogans and empty on mechanism. These four inputs fix the vocabulary gap so Day 1 can teach, not define terms.

**The floor.** If nothing else, watch the two short videos (items 3 and 4). That is the literacy layer. After these four, stop collecting courses — more intake is procrastination.`,
        resources: [
          {
            type: "COURSE",
            title: "AI for Everyone (audit — skip the certificate)",
            author: "Andrew Ng · Coursera",
            url: "https://www.coursera.org/learn/ai-for-everyone",
          },
          {
            type: "COURSE",
            title: "Generative AI for Everyone — Week 1 only (~30 min video)",
            author: "Andrew Ng · DeepLearning.AI",
            url: "https://www.deeplearning.ai/courses/generative-ai-for-everyone/",
            durationMin: 30,
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
            title: "Large Language Models explained briefly",
            author: "3Blue1Brown",
            url: "https://www.youtube.com/watch?v=LPZh9BOjkQs",
            durationMin: 8,
          },
        ],
      },
    ],
  },
  {
    kicker: "Day 1 · Mechanics without romance",
    title: "Enough mechanism to stop being a customer of slides",
    subtitle:
      "You teach. Videos are clips, not the class. The contract: this is not a model zoo, a vendor fair, or a safety sermon.",
    modules: [
      {
        code: "D1-A",
        title: "What the machine actually does",
        stanfordWeek: "Build a foundation in AI / ML overview",
        timeSlot: "09:20–10:50",
        duration: "90 min",
        summary:
          "Teach the mechanism on a whiteboard, in order. Then run one real document through three models and mark what is wrong in red.",
        body: `**Teach in this order, on a whiteboard:**

- **Token** = a chunk of text, not a "thought"
- **Next-token prediction** = the whole trick
- **Training** (one-off, expensive, weights change) vs **inference** (every query, you pay per token)
- **Temperature / sampling** = why the same prompt is not a laboratory method
- **Hallucination** is not a bug in the PR sense — it is the model completing a pattern with no grounding obligation

**Watch in class (pick one, not both).** Stop the 3B1B video at ~12 min if the room glazes. Assign Karpathy as homework if short on time — chapters 0:00–17:52 cover inference, training, and the assistant fine-tune.

**Exercise (20 min).** Each person pastes the first page of a real opinion / mandate / email they wrote last week into Claude, ChatGPT and Gemini. Ask: *what is the claim, what is the evidence, what is missing?* They mark what is wrong in red. That is the course.`,
        resources: [
          {
            type: "VIDEO",
            title: "Transformers, the tech behind LLMs (stop at ~12 min)",
            author: "3Blue1Brown",
            url: "https://www.youtube.com/watch?v=wjZofJX0v4M",
            durationMin: 27,
          },
          {
            type: "VIDEO",
            title: "[1hr Talk] Intro to Large Language Models",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
            note: "Chapters 0:00–17:52 = inference, training, assistant fine-tune. Reused on Day 1 afternoon.",
          },
          {
            type: "EXERCISE",
            title: "Three-model red-pen: claim / evidence / missing",
            durationMin: 20,
            note: "Paste a real page you wrote into Claude + ChatGPT + Gemini. Mark what is wrong in red.",
          },
        ],
      },
      {
        code: "D1-B",
        title: "Prompt vs RAG vs fine-tune vs buy the bigger model",
        stanfordWeek: "Foundation models / genAI primer",
        timeSlot: "11:10–12:10",
        duration: "60 min",
        summary:
          "Four levers. Almost every vendor conflates them. Learn when each is the right tool and when it is theatre.",
        body: `**Four levers, and where each is theatre:**

| Lever | What changes | Right tool when | Theatre when |
| --- | --- | --- | --- |
| Better prompt / more context | nothing in the weights | one-off drafting, interrogation | "our proprietary prompt library" as a product |
| RAG | documents retrieved at ask-time | your corpus changes; you need citations | junk PDFs in a vector DB with no eval |
| Fine-tune | weights | stable style/format at high volume | "train it on all our opinions" with 40 examples |
| Bigger / newer model | vendor bill | hard reasoning, messy tools | default answer to every problem |

**Worked cut.** A recent published opinion is a *retrieval* problem. A house style for draft minutes is a *fine-tune or a good prompt plus examples*. Do not fine-tune a model to "know toxicology" — that is not what fine-tuning does.`,
        resources: [
          {
            type: "VIDEO",
            title: "9 AI Concepts Explained (skip to RAG / agents / LoRA)",
            url: "https://www.youtube.com/watch?v=nVnxG10D5W0",
            durationMin: 7,
          },
        ],
      },
      {
        code: "D1-C",
        title: "Agents, autonomy & why brownfield eats demos",
        stanfordWeek: "Autonomous systems & decision-making",
        timeSlot: "13:10–14:10",
        duration: "60 min",
        summary:
          "An agent is a model allowed to call tools in a loop. It fails on undocumented exceptions, messy tool output, no stop condition, or when a wrong action is legal.",
        body: `**Definition.** An *agent* is a model allowed to call tools in a loop — search, write, click, code, retrieve.

**It fails when:**

- the process has undocumented exceptions
- the tool output is messy
- there is no stop condition
- the cost of a wrong action is legal

**Exercise.** Take one process that looks automatable (literature screen, dossier completeness, meeting minutes, an outbreak cluster narrative). Write: **unit of work / human fallback / what happens if it is confidently wrong.** Most people discover they cannot name the unit of work. That is the lesson.`,
        resources: [
          {
            type: "VIDEO",
            title: "Intro to LLMs — tool use (27:43) & security (45:43)",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
            note: "Same video as the morning. 45:43 covers jailbreaks, prompt injection, data poisoning.",
          },
          {
            type: "EXERCISE",
            title: "Name the unit of work",
            note: "One automatable process → unit of work / human fallback / cost of a confident-wrong.",
          },
        ],
      },
      {
        code: "D1-D",
        title: "Risk they can already govern",
        stanfordWeek: "Lead AI responsibly / ethics-legal-workforce",
        timeSlot: "14:25–15:25",
        duration: "60 min",
        summary:
          "Not 'AI ethics'. Four buckets they already know how to run: confidentiality, integrity of the record, workforce, liability.",
        body: `**Four buckets — governance they already run:**

- **Confidentiality** — does the text leave the building?
- **Integrity of the record** — can a draft become a final output without a named reviewer?
- **Workforce** — who is deskilled vs amplified?
- **Liability** — the Air Canada chatbot case is the one-slide warning: if it speaks to the public, it is the organisation speaking.

**Close Day 1 — homework, non-negotiable.** Tonight each person runs one real task through a model and brings the raw output *plus their edit* tomorrow. No edit = they present the raw output to the room. Social pressure is the pedagogy.`,
        resources: [
          {
            type: "VIDEO",
            title: "Foundation Models explainer (rewatch if pre-work was skipped)",
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
        ],
      },
    ],
  },
  {
    kicker: "Day 2 · Their P&L — time-to-decision, quality, legal exposure",
    title: "From mechanism to bets",
    subtitle:
      "Open with fifteen minutes of last night's homework: people seeing the model is fast and uneven. Do not skip it.",
    modules: [
      {
        code: "D2-A",
        title: "How value actually appears",
        stanfordWeek: "How orgs create value / case studies",
        timeSlot: "09:20–10:50",
        duration: "90 min",
        summary:
          "Five workflow types. For each: hours saved, failure mode, owner of the mess, whether data can leave the tenant. One sentence to leave with: a demo is not a system — an eval set is.",
        body: `**Five workflow shapes** (replace vendor anecdotes with your own):

1. **Draft / rewrite / translate** — minutes, letters, web copy
2. **Interrogate a pack** — dossier, mandate, contract, vendor deck
3. **Literature / evidence map** — with retrieval, not vibes
4. **Surveillance assist** — a cluster narrative *after* the pipeline, not instead of it
5. **Meeting / decision support** — agenda, open questions, what is *not* decided

For each, name: **expected hours saved · failure mode · owner of the mess · whether data can leave the tenant.**

**The one sentence they must leave with:** a demo is not a system. An eval set is.`,
        resources: [
          {
            type: "VIDEO",
            title: "How To Build AI Evals (first 20 min)",
            author: "Hamel Husain",
            url: "https://www.youtube.com/watch?v=mF4CaijvJos",
            durationMin: 20,
          },
          {
            type: "VIDEO",
            title: "Evals deep-dive (if the room is product-literate)",
            author: "Lenny's Podcast · Husain & Shreya Shankar",
            url: "https://www.youtube.com/watch?v=BsWxPI9UM4c",
            note: "Optional longer alternative to the Husain clip.",
          },
        ],
      },
      {
        code: "D2-B",
        title: "Talk to vendors and to your own IT",
        stanfordWeek: "Communicate with the tech team",
        timeSlot: "11:10–12:00",
        duration: "45 min",
        summary:
          "The 15-minute walk-away script on one slide. Role-play a vendor. Serious teams have numbers; 'transformative' is the tell.",
        body: `**The walk-away script — one slide, six questions.** If they cannot answer, they are selling a deck.

1. What is the **unit of work**?
2. What is the **eval set** — who labelled it, what is pass/fail?
3. What is the **human fallback** when it is wrong *and* confident?
4. What is **cost at 10× volume** — tokens, review hours, rework?
5. What **data leaves the building**, retained how long, trained on or not?
6. Where did a similar deployment **fail in public**?

Serious teams have numbers. "Transformative" is the tell.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Role-play a vendor with the six-question script",
            note: "One person sells, the room runs the script. Score: numbers vs adjectives.",
          },
        ],
      },
      {
        code: "D2-C",
        title: "Five candidate bets for this house",
        stanfordWeek: "Identify strategic opportunities for your org",
        timeSlot: "13:00–14:30",
        duration: "90 min",
        summary:
          "Small groups. Each picks one workflow and fills a one-pager. You facilitate; you do not pick winners in the room.",
        body: `**Each group fills a one-pager for one workflow from the morning list:**

- **Decision** it supports
- **Data** it needs
- **Eval** — 20 real examples, labelled by a scientist, not a vendor
- **Owner**
- **Kill criterion** — what result in 30 days means stop
- What **legal / cyber must enable**, not forbid

You facilitate. You do not pick winners in the room — forcing the choice is the ED's job later.`,
        resources: [
          {
            type: "EXERCISE",
            title: "One-pager per bet",
            note: "Decision · data · eval (20 labelled examples) · owner · kill criterion · enablement.",
          },
        ],
      },
      {
        code: "D2-D",
        title: "Governance that is a path, not a wall",
        stanfordWeek: "Lead AI responsibly / ethics-legal-workforce",
        timeSlot: "14:45–15:30",
        duration: "45 min",
        summary:
          "Rewrite the implicit rule from 'no, until we understand it' to 'yes in a sandbox, with an eval, a named reviewer, and a log'.",
        body: `**Rewrite the implicit rule.**

- **Current:** "No, until we understand it."
- **Target:** "Yes in a sandbox, with an eval, a named reviewer, and a log. Production only when the eval holds."

Cyber and legal stay in the room as **design partners for the path**. If they can only say no, they are deciding the organisation stays analog. Name that.`,
        resources: [],
      },
    ],
  },
  {
    kicker: "After the two days · Turn learning into action",
    title: "The 30-day forced-use contract",
    subtitle:
      "Read it aloud. They sign or they don't come back to the monthly clinic. Thirty days of forced use — one real task a day, 20 minutes, same three tools all month so they learn the models, not the brand of the week.",
    modules: [
      {
        code: "30D",
        title: "30-day protocol",
        stanfordWeek: "Turn learning into action",
        duration: "30 days",
        summary:
          "One real task a day. Same three tools all month. The iron rule: never forward an AI output you have not edited.",
        body: `**One real task a day, 20 minutes. Same three tools all month** — learn the models, not the brand of the week.

| Week | Daily task |
| --- | --- |
| 1 | Draft or rewrite something you would have written anyway (email, minute, note) |
| 2 | Interrogate a document you did **not** write (contract clause, vendor slide, draft page) |
| 3 | Summarise a pack and list what the summary **cannot** be used for |
| 4 | Challenge an AI output from a colleague or vendor; write the failure mode |

**Iron rule.** You may not forward an AI output you have not edited. Unedited forward = you own the error.

**Friday 20-min clinic.** Bring one win and one miss. No slides. This is the antidote to "I went on leave and I'm behind." Behind on model names is irrelevant. Behind on spotting a fluent wrong paragraph is the risk.`,
        resources: [
          {
            type: "EXERCISE",
            title: "Sign the 30-day contract",
            note: "One task/day · same three tools · never forward an unedited output · Friday clinic.",
          },
        ],
      },
    ],
  },
  {
    kicker: "Standing sources · keep, don't binge",
    title: "Core references & optional deep dives",
    subtitle:
      "Watch once, reuse the clips. Deep dives are for practitioners only — steal a clip, don't assign the four-hour sessions.",
    modules: [
      {
        code: "SRC-1",
        title: "Core — watch once, reuse clips",
        summary: "The seven references worth re-cutting for every future cohort.",
        resources: [
          {
            type: "VIDEO",
            title: "LLMs explained briefly",
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
            title: "[1hr Talk] Intro to Large Language Models",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=zjkBMFhNj_g",
            durationMin: 60,
          },
          {
            type: "VIDEO",
            title: "State of GPT — pretrain → SFT → RLHF",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=bZQun8Y4L2A",
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
            title: "Data Science & AI Strategy takeaways",
            author: "Kuang Xu · Stanford GSB",
            url: "https://www.youtube.com/watch?v=HjRtK0JguBY",
            durationMin: 5,
          },
          {
            type: "VIDEO",
            title: "LLM Evals: Common Mistakes",
            author: "Hamel Husain",
            url: "https://www.youtube.com/watch?v=GL0XhAj5LPE",
            durationMin: 28,
          },
        ],
      },
      {
        code: "SRC-2",
        title: "Optional deep dives — practitioners only",
        summary: "Not for the exec cohort. Steal a clip; don't assign the long sessions.",
        resources: [
          {
            type: "VIDEO",
            title: "Let's build GPT from scratch",
            author: "Andrej Karpathy",
            url: "https://www.youtube.com/watch?v=kCc8FmEb1nY",
            note: "Only if someone on the technical side asks.",
          },
          {
            type: "VIDEO",
            title: "Stanford HAI Foundation Models workshop (playlist)",
            author: "Stanford HAI",
            url: "https://www.youtube.com/playlist?list=PLYLBSCrrqNXz1RQCVwv7mApexCcn7Bybk",
            note: "Too long to assign — steal a clip, don't assign the four-hour sessions.",
          },
        ],
      },
    ],
  },
];

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@ai.devalier.com";
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

  const slug = "ai-for-decision-makers";
  await prisma.course.deleteMany({ where: { slug } });

  const course = await prisma.course.create({
    data: {
      slug,
      title: "AI for Decision-Makers",
      subtitle: "Two days of mechanism, evals and brownfield reality — then thirty days of forced use.",
      description:
        "A working map for executives who need to stop being customers of slides. You skip the guest-speaker tourism and add the two things the job actually needs: evals and brownfield failure.",
      order: 0,
    },
  });

  for (const [si, s] of sections.entries()) {
    const section = await prisma.section.create({
      data: {
        courseId: course.id,
        kicker: s.kicker || "",
        title: s.title,
        subtitle: s.subtitle || "",
        order: si,
      },
    });
    for (const [mi, m] of s.modules.entries()) {
      const mod = await prisma.module.create({
        data: {
          sectionId: section.id,
          code: m.code || "",
          title: m.title,
          stanfordWeek: m.stanfordWeek || "",
          timeSlot: m.timeSlot || "",
          duration: m.duration || "",
          summary: m.summary || "",
          body: m.body || "",
          order: mi,
        },
      });
      for (const [ri, r] of (m.resources || []).entries()) {
        await prisma.resource.create({
          data: {
            moduleId: mod.id,
            type: r.type,
            title: r.title,
            url: r.url || "",
            author: r.author || "",
            durationMin: r.durationMin ?? null,
            note: r.note || "",
            order: ri,
          },
        });
      }
    }
  }
  console.log("Curriculum seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
