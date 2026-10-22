/**
 * Worksheets for the course's EXERCISE resources, keyed by the stable module
 * `code`. They live in code, not the database, so re-seeding never touches
 * them. Answers are kept in the learner's own browser (see ExerciseWorkspace);
 * nothing here is sent to the server.
 */

export type ExField = {
  id: string;
  label: string;
  hint?: string;
  kind?: "text" | "area" | "choice";
  options?: string[];
};
export type ExGroup = { title: string; note?: string; fields: ExField[] };
/** Original source material shown inside the worksheet, so no outside service is needed. */
export type ExPack = {
  intro: string;
  source: { title: string; text: string };
  items: { title: string; text: string }[];
  /** feedback, revealed on request after the learner has marked the items */
  key: string[];
};
export type Exercise = {
  /** module code the worksheet belongs to */
  code: string;
  title: string;
  minutes?: number;
  /** why you are doing this */
  why: string;
  /** how to do it, in order */
  steps: string[];
  /** a caution shown above the worksheet */
  warn?: string;
  pack?: ExPack;
  groups: ExGroup[];
  /** a row of day boxes (the 30-day plan) */
  days?: number;
  /** a choice field whose answer counts toward a score, e.g. "Figure". `renamed` maps an old
   * option value to its current one, so answers saved before a rename still count. */
  score?: { fieldSuffix: string; good: string; label: string; renamed?: Record<string, string> };
};

export const EXERCISES: Record<string, Exercise> = {
  "D1-A": {
    code: "D1-A",
    title: "Red-pen three answers",
    minutes: 20,
    why:
      "You can only judge an answer about a document you know cold. This is a calibration run: fluent, confident answers are wrong in small, specific ways, and they disagree with each other. Hand-marking errors against fixed criteria (claim / evidence / missing) is a small evaluation, the habit Day 2 builds on: \"a demo is not a system, an eval set is.\"",
    steps: [
      "Read the one-page memo below until you know it cold.",
      "Read each of the three answers to \"What is the claim, what is the evidence, what is missing?\" against the memo. Mark anything wrong: invented, misread, overstated, or left out.",
      "Record what you marked, then fill in the comparison.",
      "Open the answer key and compare it with your marks. Where you differ, decide who is right.",
      "Optional: repeat with a page of your own and any assistant you already use. Nothing here requires one.",
    ],
    warn:
      "The memo and answers were written for this exercise. They are not real model output, and real assistants make different mistakes. Never paste a document into an outside service unless you are allowed to share it.",
    pack: {
      intro: "A fictional memo and three fictional answers to the same question.",
      source: {
        title: "Marlowe Pool: winter schedule proposal (fictional)",
        text:
          "Prepared by the facilities committee, 3 March. Attendance fell 18% between 2022 and 2024, from 41,200 to 33,800 visits, driven mainly by weekday daytime sessions. Evening and weekend sessions were stable. Closing weekday mornings (6 to 9 am) would save an estimated 22,000 pounds a year in staffing; these sessions drew 9% of all visits. A members' survey (112 responses, 61% preferring evenings) was sent to members only, so it is not a representative sample. School swimming lessons use the pool 9 to 11 am on Tuesdays and Thursdays under a contract that runs to July. The committee recommends closing 6 to 9 am, Monday to Friday, from September, with a review after six months. No assessment of the effect on users over 65 has been made.",
      },
      items: [
        {
          title: "Answer A",
          text:
            "Claim: close the pool on weekday mornings from September. Evidence: attendance is down 18% over two years, 61% of surveyed swimmers prefer evenings, and the change saves 22,000 pounds a year. Missing: nothing significant; the case is complete.",
        },
        {
          title: "Answer B",
          text:
            "Claim: close weekday mornings and the Tuesday and Thursday school sessions. Evidence: attendance fell 28% and the closure saves 22,000 pounds a year. Missing: the council has not yet signed off, and the school contract has to be renegotiated.",
        },
        {
          title: "Answer C",
          text:
            "Claim: close 6 to 9 am Monday to Friday from September, reviewed after six months. Evidence: visits fell 18% (41,200 to 33,800), mostly because weekday mornings emptied; those sessions are 9% of visits and cost 22,000 pounds a year. The survey of 112 members is not representative. Missing: no assessment of the effect on users over 65.",
        },
      ],
      key: [
        "Answer A: overstates. The survey is presented as evidence although the memo says it is not representative. Calling the case \"complete\" omits the missing over-65 assessment and the six-month review.",
        "Answer B: misreads and invents. The memo proposes closing 6 to 9 am only; the school lessons run 9 to 11 am and are not affected. The 28% figure is wrong (it is 18%). Council sign-off is not mentioned anywhere in the memo.",
        "Answer C: closest, with one overstatement. The memo says the decline was driven mainly by weekday daytime sessions, not specifically mornings.",
        "What all three miss: the memo gives no figure for how many morning swimmers would move to other sessions, so the saving may be smaller than the staffing estimate suggests.",
      ],
    },
    groups: [
      ...["A", "B", "C"].map((a) => ({
        title: `Answer ${a}`,
        fields: [
          {
            id: `ans${a}-red`,
            label: "Red pen: what is wrong",
            hint: "Quote the sentence. Say why: invented, misread, overstated, or omitted.",
            kind: "area" as const,
          },
          { id: `ans${a}-count`, label: "Errors you marked", kind: "text" as const },
        ],
      })),
      {
        title: "Compare",
        fields: [
          { id: "differ", label: "Where did the three answers disagree?", kind: "area" },
          {
            id: "allmissed",
            label: "What did all three miss that you can see from reading the memo closely?",
            kind: "area",
          },
          {
            id: "edit",
            label: "Would you sign any of these as is? What edit would it need?",
            kind: "area",
          },
        ],
      },
    ],
  },

  "D1-C": {
    code: "D1-C",
    title: "Name the unit of work",
    minutes: 15,
    why:
      "Agents fail on undocumented exceptions, messy output, no stop condition and costly mistakes. Naming the unit of work and the fallback turns \"automate this process\" into something you can test and bound.",
    steps: [
      "Pick one live process you run or sit next to. If you have none, use the sample below.",
      "Name the single thing that goes in and the single thing that comes out: the unit of work.",
      "Say who takes over when the machine cannot finish, and how they find out.",
      "Write what happens, and who pays, if it is confidently wrong.",
    ],
    pack: {
      intro: "Sample process (fictional), if you have no live process to hand. Try your own answers first, then open the key.",
      source: {
        title: "Larkfield Supplies: the accounts inbox",
        text:
          "About 300 emails a day reach accounts@. Roughly a third are invoice queries such as \"where is my payment?\" or \"the total does not match our purchase order\". A clerk finds the invoice and purchase order in the finance system, checks the payment status and replies. Anything disputing more than 500 pounds goes to the finance manager. The company is considering an AI agent for the invoice queries.",
      },
      items: [],
      key: [
        "Unit of work: one customer email in; one reply sent, or one hand-off note, out. \"Answer invoice queries\" is not a unit.",
        "Human fallback: the clerk queue takes any email where no invoice number matches, the amount in dispute is over 500 pounds, or the wording is legal or angry. The trigger is the agent's own flag, and a clerk picks it up within two working hours.",
        "If it is confidently wrong: a wrong payment date makes the customer plan around it. The cost is a repeat contact, a damaged relationship and sometimes a late-payment dispute. It is found when the customer writes back, or when a clerk checks a weekly sample of sent replies.",
        "Stop condition: stop after one reply or one hand-off per email. A second message on the same thread goes to a person, so the agent cannot loop with a customer.",
      ],
    },
    groups: [
      {
        title: "Your process",
        fields: [
          { id: "process", label: "Process", kind: "text" },
          { id: "unit", label: "Unit of work", hint: "One input, one output. If you need \"and\", it is two.", kind: "area" },
          { id: "fallback", label: "Human fallback", hint: "Who, with what trigger, within how long.", kind: "area" },
          { id: "confident", label: "If it is confidently wrong", hint: "Who finds out, when, at what cost: money, legal, reputation.", kind: "area" },
          { id: "stop", label: "Stop condition", hint: "How does the loop know it is finished, or should give up?", kind: "area" },
        ],
      },
    ],
  },

  "D2-B": {
    code: "D2-B",
    title: "Six-question vendor script",
    minutes: 30,
    why:
      "Serious teams can usually give specifics; a pitch made only of adjectives is a warning sign. Marking each answer as a figure, an adjective or no answer makes a pitch comparable to the last one and shows what you still need to ask for. A figure is not proof of quality: ask where it came from.",
    steps: [
      "Take a real supplier deck or internal proposal. If you have none, use the sample pitch below.",
      "For each question, write what the document actually says, in its own words where you can.",
      "Mark the answer: a figure (a number, a count, a named dataset), an adjective (\"robust\", \"transformative\"), or no answer at all.",
    ],
    pack: {
      intro: "Sample pitch (fictional), if you have no real document. Answer the six questions from it, then open the key.",
      source: {
        title: "AuroraDesk: finance assistant pitch",
        text:
          "AuroraDesk is a transformative, enterprise-grade AI assistant for finance teams. Our robust platform has been battle-tested at leading firms and delivers best-in-class accuracy. In one pilot, invoices were processed 38% faster. Your data is secure with us, and our world-class support ensures a seamless rollout.",
      },
      items: [],
      key: [
        "Unit of work: no answer. The pitch never says what goes in or comes out.",
        "Eval set: adjective (\"best-in-class accuracy\"). There is no labelled set, no pass mark and no number.",
        "Human fallback: no answer.",
        "Cost at 10x volume: no answer. The 38% is a number, but it is a speed in one pilot, not a cost at scale, and the pitch does not say how it was measured.",
        "Data: adjective (\"secure\"). Nothing on what leaves the building, how long it is kept or whether it is trained on.",
        "Public failure of a similar deployment: no answer.",
        "Score: 0 of 6 answered with a figure. Even a figure would only be a claim to check. The finding is the list of what to ask for before the next meeting.",
      ],
    },
    score: { fieldSuffix: "-kind", renamed: { Number: "Figure" }, good: "Figure", label: "answered with a figure (something to check, not proof of quality)" },
    groups: [
      { q: "What is the unit of work?", k: "unit" },
      { q: "What is the eval set: who labelled it, and what is pass/fail?", k: "eval" },
      { q: "What is the human fallback when it is wrong and confident?", k: "fallback" },
      { q: "What is the cost at 10× volume: tokens, review hours, rework?", k: "cost" },
      { q: "What data leaves the building, retained how long, and is it trained on?", k: "data" },
      { q: "Where did a similar deployment fail in public?", k: "failure" },
    ].map(({ q, k }) => ({
      title: q,
      fields: [
        { id: `${k}-says`, label: "What the pitch says", kind: "area" as const },
        {
          id: `${k}-kind`,
          label: "Figure or adjective?",
          kind: "choice" as const,
          options: ["Figure", "Adjective", "No answer"],
        },
      ],
    })),
  },

  "D2-C": {
    code: "D2-C",
    title: "One page per candidate use",
    minutes: 45,
    why:
      "Don't pick a winner yet. Writing the same page for each candidate makes them comparable, and the kill criterion forces you to say in advance what would make you stop.",
    steps: [
      "Choose one workflow in your unit. If you have none, use the sample below.",
      "Fill in each line. If you cannot, that is the finding: write what is missing.",
      "Copy the page out and repeat for the next candidate.",
    ],
    pack: {
      intro: "Sample candidate (fictional): Larkfield Supplies' invoice queries, as in the sample for \"Name the unit of work\". Fill in the page yourself, then compare with the key.",
      source: {
        title: "Candidate: answering invoice queries",
        text:
          "About a hundred invoice-query emails a day reach the accounts inbox. A clerk checks the finance system and replies; disputes over 500 pounds go to the finance manager.",
      },
      items: [],
      key: [
        "Decision it supports: whether and when a customer is told a payment is on its way.",
        "Data it needs: invoice, purchase order and payment status, read-only, plus the incoming email. Nothing else from the finance system.",
        "Eval: 20 past emails with the correct reply written by a senior clerk, chosen to include awkward cases, not only easy ones. Right means the facts match the system and the tone is acceptable to the clerk.",
        "Owner: the finance operations lead. A named role, not a team.",
        "Kill criterion: more than 2 of the 20 replies need a clerk's correction, or any reply misstates a payment date, within 30 days.",
        "What legal / cyber must enable: a read-only service account for the finance system and a decision on how long customer emails may be kept.",
      ],
    },
    groups: [
      {
        title: "Candidate",
        fields: [
          { id: "workflow", label: "Workflow", kind: "text" },
          { id: "decision", label: "Decision it supports", kind: "area" },
          { id: "data", label: "Data it needs", kind: "area" },
          { id: "eval", label: "Eval: 20 real examples, labelled by a practitioner", hint: "Where from, who labels, what counts as right.", kind: "area" },
          { id: "owner", label: "Owner", kind: "text" },
          { id: "kill", label: "Kill criterion", hint: "What result within 30 days means stop.", kind: "area" },
          { id: "enable", label: "What legal / cyber must enable, not forbid", kind: "area" },
        ],
      },
    ],
  },

  "D1-E": {
    code: "D1-E",
    title: "Can I put this into AI? Four cases",
    minutes: 25,
    why:
      "Whether you may put someone else's material into an AI tool is five questions, not one: copyright, the licence you accepted, confidentiality, the provider's terms and your institution's rules. Working four cases against one set of terms shows how the answer changes with the act (summarising for yourself, uploading, sharing) and why \"more information needed\" is sometimes the right answer.",
    steps: [
      "Read the fictional subscriber terms below. They are invented for this exercise and say nothing about any real publisher.",
      "For each case, work down the sequence: jurisdiction and purpose, lawful access, licence and exceptions, link / excerpt / full upload, where it is processed, what the output reproduces, who it goes to.",
      "Choose an outcome, write the fact that decided it, and name any fact you are missing.",
      "Open the key and compare. Where you differ, decide whether you used a fact the case does not give.",
    ],
    warn:
      "This is teaching material, not legal advice. Real terms, jurisdictions and institutional licences differ; read the ones in front of you, and ask your librarian or legal office when they are unclear.",
    pack: {
      intro: "Fictional terms and four fictional cases.",
      source: {
        title: "Fenwick Review: subscriber terms (fictional)",
        text:
          "A Fenwick Review subscription gives one named reader access for personal, non-commercial reading. You may quote up to 100 words of an article with attribution. You may not copy, redistribute or make an article available to others. You may not submit content to any third-party software service, including automated summarisation or machine-learning tools, without our written permission. Institutional site licences are separate and are listed on your library's page.",
      },
      items: [
        {
          title: "Case 1: private summary",
          text:
            "Maya is a Fenwick subscriber in the UK. She reads an article, then writes a five-line summary of its argument in her own words in her notebook, for her own use.",
        },
        {
          title: "Case 2: upload to a chatbot",
          text:
            "Dev, a subscriber, pastes the full text of an article into a public chatbot and asks for a summary. He has not read the chatbot's terms.",
        },
        {
          title: "Case 3: sharing a substitute",
          text:
            "Dev emails the chatbot's summary to 40 colleagues instead of the article. The summary follows the article's structure and reuses many of its sentences.",
        },
        {
          title: "Case 4: a literature review",
          text:
            "Priya is a researcher who wants to run 200 journal articles through an AI tool for a literature review. The articles come through her university library. The country and the library's licence terms are not stated, and she has not decided which tool to use.",
        },
      ],
      key: [
        "Case 1: permit. She is using her own words, for personal study, and no copy of the article has been made or passed on. That changes if the notes begin to copy passages at length, or if the notebook is shared.",
        "Case 2: not as it stands. These terms bar submitting content to a third-party service without permission, so the contract settles it before any copyright question does, and the chatbot's retention and training terms are unknown. Choose an alternative (summarise it yourself, or use a tool the institution has licensed) or seek the publisher's written permission.",
        "Case 3: restrict. The terms bar redistribution, and a summary that reuses the article's sentences and structure can reproduce protected expression and stand in for the original. Alternative: share the link and two lines in your own words, or check whether your organisation holds a site licence that allows sharing.",
        "Case 4: more information needed. The jurisdiction, the library licence's terms on AI and text mining, whether the tool is local or a third-party service and how long it keeps data all decide the answer. The route is to ask the subject librarian or research-support office, and to say which of those facts you are missing. Do not answer yes on the strength of \"it is for research\" or no on the strength of \"it is AI\".",
        "Across the four: the same article gives four different outcomes because the act changes. Summarising for yourself, uploading, sharing a substitute and bulk processing are separate questions.",
      ],
    },
    groups: [
      ...["1", "2", "3", "4"].map((n) => ({
        title: `Case ${n}`,
        fields: [
          {
            id: `case${n}-outcome`,
            label: "Outcome",
            kind: "choice" as const,
            options: ["Permit", "Restrict", "Choose an alternative", "Seek advice", "More information needed"],
          },
          { id: `case${n}-why`, label: "The fact that decided it", kind: "area" as const },
          { id: `case${n}-missing`, label: "Facts you are missing", hint: "Write \"none\" only if you are sure.", kind: "text" as const },
        ],
      })),
      {
        title: "Your own situation",
        fields: [
          {
            id: "own",
            label: "Something you want to put into an AI tool: which of the five questions do you not yet know the answer to, and who will you ask?",
            kind: "area",
          },
        ],
      },
    ],
  },

  "30D": {
    code: "30D",
    title: "The 30-day plan",
    minutes: 20,
    why:
      "Two days teaches the vocabulary; judgement comes from reps. Using the same approach all month means you learn the habit, not the brand of the week. An AI tool is optional: every task works on paper, and no particular service is needed.",
    steps: [
      "Tick a day when you have done one real task, about twenty minutes. Use an AI tool only if you already have one and are allowed to; the task works without.",
      "Week 1 draft or rewrite; week 2 interrogate a document you did not write; week 3 summarise a pack and list what the summary cannot be used for; week 4 challenge an AI output and write its failure mode.",
      "Friday, 20 minutes: one win, one miss. No slides.",
    ],
    days: 30,
    groups: [
      {
        title: "Commitment",
        fields: [
          { id: "assistants", label: "Tools you will use, if any (optional)", hint: "Any tool you already have, or none.", kind: "text" },
          { id: "time", label: "When in the day", kind: "text" },
        ],
      },
      {
        title: "Friday check-in",
        fields: [
          { id: "win", label: "One win", kind: "area" },
          { id: "miss", label: "One miss", kind: "area" },
        ],
      },
    ],
  },
};
