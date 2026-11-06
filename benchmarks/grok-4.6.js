"use strict";

const AGENTS = ["Researcher", "Builder", "Reviewer", "Publisher"];
const STATUSES = ["queued", "running", "handoff", "done"];

function blobOf(task) {
  return [
    task.goal || "",
    ...(task.constraints || []),
    ...(task.artifacts || []),
    task.doneWhen || "",
  ]
    .join(" ")
    .toLowerCase();
}

function pickAgent(task) {
  const text = blobOf(task);
  const goal = (task.goal || "").toLowerCase();

  const publisherSignals =
    /\b(submit(?:\s+text)?|submission|screenshot|repo\s+link|repo\s+url|packag(?:e|ing)|publish)\b/.test(
      text
    );
  const reviewerSignals =
    /\b(review|quality|qa|audit|lint|write a comparison|code review)\b/.test(text);
  const builderSignals =
    /\b(implement|fix|bug|refactor|code|feature|patch|failing test)\b/.test(text);
  const researcherSignals =
    /\b(gather|research|look up|survey|compar(?:e|ing)|pricing|docs|sources)\b/.test(
      text
    );

  // Publisher owns packaging submit text, screenshots, or repo links.
  if (publisherSignals && !/\b(implement|fix|review quality)\b/.test(goal)) {
    return "Publisher";
  }

  // Reviewer owns quality checks and write-ups of a comparison.
  if (reviewerSignals && !/\b(implement|fix(?:ing)? code)\b/.test(goal)) {
    return "Reviewer";
  }

  // Builder owns implementing or fixing code.
  if (builderSignals) {
    return "Builder";
  }

  // Researcher owns gathering and comparing information.
  if (researcherSignals) {
    return "Researcher";
  }

  return "Researcher";
}

function looksDone(task) {
  const artifacts = (task.artifacts || []).join(" ").toLowerCase();
  if (!artifacts) return false;

  const doneHints = [
    "final",
    "submitted",
    "merged",
    "approved",
    "complete",
    "submit-package",
    "shipped",
  ];
  return doneHints.some((hint) => artifacts.includes(hint));
}

function artifactsLookLike(artifacts, kind) {
  const blob = artifacts.join(" ").toLowerCase();
  if (kind === "research") {
    return /\b(notes|research|sources|comparison\.md|findings)\b/.test(blob);
  }
  if (kind === "build") {
    return /\.(js|ts|tsx|py|go|rs|java)\b|\bsrc\/|\btests?\//.test(blob);
  }
  if (kind === "review") {
    return /\b(review|diff|qa-report|lighthouse)\b/.test(blob);
  }
  if (kind === "publish") {
    return /\b(screenshot|submit|readme|repo\.md)\b/.test(blob);
  }
  return false;
}

function pickStatus(task, primaryAgent) {
  const artifacts = task.artifacts || [];
  if (artifacts.length === 0) return "queued";
  if (looksDone(task)) return "done";

  const isHandoff =
    (primaryAgent === "Builder" &&
      artifactsLookLike(artifacts, "research") &&
      !artifactsLookLike(artifacts, "build")) ||
    (primaryAgent === "Reviewer" &&
      artifactsLookLike(artifacts, "build") &&
      !artifactsLookLike(artifacts, "review")) ||
    (primaryAgent === "Publisher" &&
      (artifactsLookLike(artifacts, "build") ||
        artifactsLookLike(artifacts, "review")) &&
      !artifactsLookLike(artifacts, "publish"));

  return isHandoff ? "handoff" : "running";
}

function clipGoal(goal) {
  const trimmed = (goal || "the current lab task").trim();
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}...` : trimmed;
}

function buildChecklist(task, primaryAgent) {
  const goal = clipGoal(task.goal);
  const constraints =
    (task.constraints || []).length > 0
      ? task.constraints.join("; ")
      : "the stated lab constraints";
  const doneWhen = task.doneWhen || "the doneWhen condition is met";

  const byAgent = {
    Researcher: [
      `List the questions needed to ${goal}`,
      `Collect public sources while honoring: ${constraints}`,
      "Tabulate findings side by side with citations",
      `Save the comparison so the next agent can start when ${doneWhen}`,
    ],
    Builder: [
      `Reproduce the current failure or skim artifacts for ${goal}`,
      `Implement or patch the code under: ${constraints}`,
      "Run the relevant tests and fix anything that breaks",
      `Stop when ${doneWhen}`,
    ],
    Reviewer: [
      `Read the artifacts against ${goal}`,
      `Check quality, correctness, and constraints: ${constraints}`,
      "Write a short comparison or review note with concrete issues",
      `Hand back a verdict once ${doneWhen}`,
    ],
    Publisher: [
      `Draft the submit text for ${goal}`,
      "Attach screenshots and the public repo link",
      `Confirm packaging stays within: ${constraints}`,
      `Seal the packet when ${doneWhen}`,
    ],
  };

  return byAgent[primaryAgent];
}

function planAgentHandoff(task) {
  const input = task || { goal: "", constraints: [], artifacts: [], doneWhen: "" };
  const primaryAgent = pickAgent(input);
  const nextStatus = pickStatus(input, primaryAgent);
  const checklist = buildChecklist(input, primaryAgent);
  const handoffNote = `${primaryAgent} is up next for this lab: ${clipGoal(input.goal)}.`;

  return { primaryAgent, nextStatus, checklist, handoffNote };
}

const nativeAssert = console.assert.bind(console);
let failedAsserts = 0;
console.assert = (value, ...message) => {
  nativeAssert(value, ...message);
  if (!value) failedAsserts += 1;
};

function assertPlan(plan, expectedAgent, expectedStatus) {
  console.assert(
    AGENTS.includes(plan.primaryAgent),
    `primaryAgent must be one of ${AGENTS.join(", ")}`
  );
  console.assert(
    plan.primaryAgent === expectedAgent,
    `expected ${expectedAgent}, got ${plan.primaryAgent}`
  );
  console.assert(
    STATUSES.includes(plan.nextStatus),
    `nextStatus must be one of ${STATUSES.join(", ")}`
  );
  console.assert(
    plan.nextStatus === expectedStatus,
    `expected status ${expectedStatus}, got ${plan.nextStatus}`
  );
  console.assert(
    Array.isArray(plan.checklist) &&
      plan.checklist.length >= 3 &&
      plan.checklist.length <= 5,
    "checklist must contain 3-5 concrete steps"
  );
  console.assert(
    plan.checklist.every((step) => typeof step === "string" && step.trim().length > 0),
    "checklist steps must be non-empty strings"
  );
  console.assert(
    typeof plan.handoffNote === "string" &&
      plan.handoffNote.trim().length > 0 &&
      !plan.handoffNote.includes("\n"),
    "handoffNote must be a single non-empty sentence"
  );
}

const researchPlan = planAgentHandoff({
  goal: "Gather and compare Groq, OpenAI, and Anthropic rate limits for the lab summarizer agent",
  constraints: ["Use only public docs", "No paid API keys"],
  artifacts: [],
  doneWhen: "A one-page comparison of rate limits and pricing is saved",
});
assertPlan(researchPlan, "Researcher", "queued");

const builderPlan = planAgentHandoff({
  goal: "Implement the agent handoff board status badges and fix the failing queue filter",
  constraints: ["Keep the existing REST API", "No new dependencies"],
  artifacts: ["src/board.js", "tests/board.test.js"],
  doneWhen: "Status badges render and the queue filter tests pass",
});
assertPlan(builderPlan, "Builder", "running");

const publisherPlan = planAgentHandoff({
  goal: "Package the MLH challenge submit text, demo screenshots, and repo link for the handoff board",
  constraints: ["Submit must include a public GitHub URL", "Max 3 screenshots"],
  artifacts: ["screenshots/board.png", "screenshots/handoff.png"],
  doneWhen: "Submit package with text, screenshots, and repo URL is ready",
});
assertPlan(publisherPlan, "Publisher", "running");

if (typeof module !== "undefined" && module.exports) {
  module.exports = { planAgentHandoff };
}

if (failedAsserts > 0) {
  process.exitCode = 1;
} else {
  console.log("planAgentHandoff assertions passed");
  console.log(
    JSON.stringify({ researchPlan, builderPlan, publisherPlan }, null, 2)
  );
}
