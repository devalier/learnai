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
  /** a choice field whose answer counts toward a score, e.g. "Number" */
  score?: { fieldSuffix: string; good: string; label: string };
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
      "Pick one live process you run or sit next to.",
      "Name the single thing that goes in and the single thing that comes out: the unit of work.",
      "Say who takes over when the machine cannot finish, and how they find out.",
      "Write what happens, and who pays, if it is confidently wrong.",
    ],
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
      "Serious teams answer with numbers; \"transformative\" is the tell. Scoring each answer as a number or an adjective makes a pitch comparable to the last one, and shows what you still need to ask for.",
    steps: [
      "Take a real supplier deck or internal proposal.",
      "For each question, write what the document actually says, in its own words where you can.",
      "Mark the answer: a number (a figure, a count, a named dataset), an adjective (\"robust\", \"transformative\"), or no answer at all.",
    ],
    score: { fieldSuffix: "-kind", good: "Number", label: "answered with numbers" },
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
          label: "Number or adjective?",
          kind: "choice" as const,
          options: ["Number", "Adjective", "No answer"],
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
      "Choose one workflow in your unit.",
      "Fill in each line. If you cannot, that is the finding: write what is missing.",
      "Copy the page out and repeat for the next candidate.",
    ],
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
