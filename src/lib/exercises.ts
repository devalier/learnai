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
  groups: ExGroup[];
  /** a row of day boxes (the 30-day plan) */
  days?: number;
  /** a choice field whose answer counts toward a score, e.g. "Number" */
  score?: { fieldSuffix: string; good: string; label: string };
};

const ASSISTANTS = ["Claude", "ChatGPT", "Gemini"];

export const EXERCISES: Record<string, Exercise> = {
  "D1-A": {
    code: "D1-A",
    title: "Three-assistant red-pen",
    minutes: 20,
    why:
      "You can only judge an answer about a document you know cold. This is a calibration run: you see how fluent, confident output is wrong in small, specific ways, and that three assistants disagree with each other. Hand-marking errors against fixed criteria (claim / evidence / missing) is a small evaluation, the habit Day 2 builds on: \"a demo is not a system, an eval set is.\"",
    steps: [
      "Pick the first page of a document you know well, from your desk. One page, not a pack.",
      "Open Claude, ChatGPT and Gemini in separate tabs. Paste the page into each, same prompt: \"What is the claim, what is the evidence, what is missing?\"",
      "Read your own page again, then each answer against it. Underline in red anything wrong: invented, misread, overstated, or left out.",
      "Record what each assistant said and what you marked below, then fill in the comparison.",
    ],
    warn:
      "Pasting a page into three outside services sends it to three vendors. Use a document you are allowed to share externally, or redact it, or use a public one. Do not paste the document into this page: record only your findings here.",
    groups: [
      ...ASSISTANTS.map((a) => ({
        title: a,
        fields: [
          { id: `${a}-claim`, label: "Claim it gave", kind: "area" as const },
          { id: `${a}-evidence`, label: "Evidence it gave", kind: "area" as const },
          { id: `${a}-missing`, label: "What it said is missing", kind: "area" as const },
          {
            id: `${a}-red`,
            label: "Red pen: what is wrong",
            hint: "Quote the sentence. Say why: invented, misread, overstated, or omitted.",
            kind: "area" as const,
          },
          { id: `${a}-count`, label: "Errors you marked", kind: "text" as const },
        ],
      })),
      {
        title: "Compare",
        fields: [
          { id: "differ", label: "Where did the three disagree?", kind: "area" },
          {
            id: "allmissed",
            label: "What did all three miss that you know from being at the desk?",
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
      "Two days teaches the vocabulary; judgement comes from reps. The same three assistants all month means you learn the tools, not the brand of the week.",
    steps: [
      "Tick a day when you have done one real task, about twenty minutes.",
      "Week 1 draft or rewrite; week 2 interrogate a document you did not write; week 3 summarise a pack and list what the summary cannot be used for; week 4 challenge an AI output and write its failure mode.",
      "Friday, 20 minutes: one win, one miss. No slides.",
    ],
    days: 30,
    groups: [
      {
        title: "Commitment",
        fields: [
          { id: "assistants", label: "Your three assistants", kind: "text" },
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
