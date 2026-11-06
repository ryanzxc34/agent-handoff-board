/**
 * Multi-agent handoff planner: picks a primary role and a concrete next step
 * from a natural-language task description.
 *
 * @param {{
 *   goal: string,
 *   constraints: string[],
 *   artifacts: string[],
 *   doneWhen: string
 * }} task
 * @returns {{
 *   primaryAgent: "Researcher"|"Builder"|"Reviewer"|"Publisher",
 *   nextStatus: "queued"|"running"|"handoff"|"done",
 *   checklist: string[],
 *   handoffNote: string
 * }}
 */
function planAgentHandoff(task) {
  const goal = String(task.goal ?? "").toLowerCase();
  const constraints = (task.constraints ?? []).map((c) => String(c).toLowerCase());
  const artifacts = (task.artifacts ?? []).map((a) => String(a).toLowerCase());
  const doneWhen = String(task.doneWhen ?? "").toLowerCase();

  const text = [goal, ...constraints, doneWhen, ...artifacts].join(" ");

  /** @type {"Researcher"|"Builder"|"Reviewer"|"Publisher"} */
  let primaryAgent = "Researcher";
  /** @type {"queued"|"running"|"handoff"|"done"} */
  let nextStatus = "queued";

  const has = (needles) =>
    needles.some((n) => text.includes(n));

  const publishingSignals = [
    "screenshot",
    "screen shot",
    "record a",
    "record the",
    "submit",
    "submission",
    "pull request",
    "pr ",
    "github.com",
    "repo link",
    "release notes",
    "changelog",
    "submission bundle",
    "package for submission",
    "mentors"
  ];

  const reviewerSignals = [
    "review",
    "audit",
    "compare",
    "comparison",
    "versus",
    " vs ",
    "lint",
    "test coverage",
    "regression",
    "quality",
    "criteria",
    "rubric",
    "security",
    "threat model",
    "checklist",
    "sign-off"
  ];

  const builderSignals = [
    "implement",
    "fix",
    "bug",
    "refactor",
    "patch",
    "build",
    "code",
    "sdk",
    "api",
    "endpoint",
    "migration",
    "schema",
    "webpack",
    "typescript",
    "react",
    "server",
    "deploy script"
  ];

  const researcherSignals = [
    "research",
    "compare libraries",
    "evaluate",
    "investigate",
    "prior art",
    "survey",
    "spike",
    "read the docs",
    "summarize"
  ];

  if (has(publishingSignals)) {
    primaryAgent = "Publisher";
  } else if (has(reviewerSignals)) {
    primaryAgent = "Reviewer";
  } else if (has(builderSignals)) {
    primaryAgent = "Builder";
  } else if (has(researcherSignals)) {
    primaryAgent = "Researcher";
  } else {
    primaryAgent = "Researcher";
  }

  const acceptanceClear =
    doneWhen.length > 0 &&
    !/\btbd\b|todo|unclear|unknown/.test(doneWhen);

  if (!acceptanceClear) {
    nextStatus = "queued";
  } else if (primaryAgent === "Publisher" || primaryAgent === "Builder") {
    nextStatus = "running";
  } else if (primaryAgent === "Researcher") {
    nextStatus = "running";
  } else if (primaryAgent === "Reviewer") {
    nextStatus = "handoff";
  } else {
    nextStatus = "queued";
  }

  /** @param {string[]} items */
  const checklistFrom = (items) => {
    const trimmed = items
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const seen = new Set();
    const out = [];
    for (const line of trimmed) {
      if (seen.has(line)) continue;
      seen.add(line);
      out.push(line);
      if (out.length >= 5) break;
    }
    while (out.length < 3) {
      out.push(`Confirm progress against: ${task.doneWhen || "the stated acceptance criteria"}`);
    }
    return out.slice(0, 5);
  };

  /** @type {string[]} */
  let checklist = [];

  if (primaryAgent === "Researcher") {
    checklist = checklistFrom([
      "List the unknowns implied by the goal and done-when criteria.",
      "Gather 2–3 credible sources or references relevant to the decision.",
      "Compare options against each listed constraint with a short pros/cons note.",
      "Write a recommendation with assumptions and risks called out explicitly.",
      "Hand findings to the next agent with file paths or links to saved notes."
    ]);
  } else if (primaryAgent === "Builder") {
    checklist = checklistFrom([
      "Reproduce or baseline the current behavior related to the goal.",
      "Implement the smallest change that satisfies done-when, respecting constraints.",
      "Add or update automated checks (tests, types, lint) touched by the change.",
      "Run the relevant test or build command and capture the output summary.",
      "Prepare a concise handoff: what changed, why, and what to verify next."
    ]);
  } else if (primaryAgent === "Reviewer") {
    checklist = checklistFrom([
      "Read the goal, constraints, artifacts, and done-when acceptance bar.",
      "Inspect the implementation diff and note correctness gaps or edge cases.",
      "Run quality gates (tests, lint, or static review) and record failures.",
      "Compare outcomes to done-when with pass/fail evidence for each criterion.",
      "Summarize blocking issues vs nice-to-haves with concrete next steps."
    ]);
  } else {
    checklist = checklistFrom([
      "Assemble the final submission bundle (text, screenshots, and links).",
      "Verify each artifact matches constraints and names files clearly.",
      "Cross-check against done-when and capture proof snippets or references.",
      "Open or update the PR with a crisp summary and test/verification notes.",
      "Publish the handoff package and link it for downstream agents."
    ]);
  }

  const handoffNote =
    primaryAgent === "Researcher"
      ? "Compile the comparison, save sources, and route the best next move to Builder or Reviewer."
      : primaryAgent === "Builder"
        ? "Land the code change with checks green and point Reviewer at the diff and test output."
        : primaryAgent === "Reviewer"
          ? "Deliver a verdict against done-when with evidence, then send blockers back to Builder or approve packaging."
          : "Bundle proof and links for submission so the lab can ship without rework.";

  return { primaryAgent, nextStatus, checklist, handoffNote };
}

// --- Multi-Agent Lab style test cases ---

const caseCompareVectorStores = planAgentHandoff({
  goal:
    "Pick an embedding + vector store stack for our RAG internal demo and document tradeoffs for the team.",
  constraints: [
    "Must run on our existing AWS account",
    "Prefer managed over self-hosted unless cost is >2x"
  ],
  artifacts: ["Current prod is Postgres-only", "Demo budget: $200/mo cap"],
  doneWhen:
    "We have a ranked shortlist (top 2) with cost, latency, and ops notes backed by doc links."
});

console.assert(caseCompareVectorStores.primaryAgent === "Researcher");
console.assert(caseCompareVectorStores.nextStatus === "running");
console.assert(caseCompareVectorStores.checklist.length >= 3);
console.assert(caseCompareVectorStores.checklist.length <= 5);

const caseFixWebhookRetries = planAgentHandoff({
  goal:
    "Fix flaky GitHub webhook delivery in the handoff bot: intermittent 429s cause missed agent updates.",
  constraints: [
    "No new infrastructure services",
    "Keep backward-compatible event parsing"
  ],
  artifacts: ["logs/webhook-429-sample.json", "src/github/dispatch.ts"],
  doneWhen:
    "Staging shows zero missed deliveries across 50 forced replays; unit tests cover backoff + idempotency."
});

console.assert(caseFixWebhookRetries.primaryAgent === "Builder");
console.assert(caseFixWebhookRetries.nextStatus === "running");
console.assert(caseFixWebhookRetries.checklist.length >= 3);
console.assert(caseFixWebhookRetries.checklist.length <= 5);

const caseShipMlHBenchmark = planAgentHandoff({
  goal:
    "Package the MLH benchmark solution: final summary, demo screenshot, repo link, and PR ready for mentors.",
  constraints: [
    "Screenshot must show passing asserts in the terminal",
    "Keep the PR description under ~300 words"
  ],
  artifacts: ["benchmarks/composer-2.5.js", "walkthrough.png"],
  doneWhen:
    "Submission checklist is complete with PR link, screenshot, and verifier commands pasted in order."
});

console.assert(caseShipMlHBenchmark.primaryAgent === "Publisher");
console.assert(caseShipMlHBenchmark.nextStatus === "running");
console.assert(caseShipMlHBenchmark.checklist.length >= 3);
console.assert(caseShipMlHBenchmark.checklist.length <= 5);

module.exports = { planAgentHandoff };
