"use strict";

/**
 * planAgentHandoff picks who should take a Multi-Agent Lab task next.
 *
 * primaryAgent is the earliest matching signal in the goal. doneWhen is used
 * only when the goal does not say. "Write a comparison" is Reviewer and
 * suppresses a generic "compare", which would otherwise look like research.
 *
 *   Publisher  — packaging submit text, screenshots, or a repo link
 *   Reviewer   — checking quality, or writing a comparison
 *   Builder    — implementing or fixing code
 *   Researcher — gathering or comparing information
 *
 * nextStatus has to be inferred; the input has no status field.
 *   done    — at least 60% of the meaningful doneWhen words appear in artifact names
 *   queued  — nothing has been saved
 *   running — a constraint says the work is in progress, or an artifact is still a draft
 *   handoff — artifacts are ready to pass on, and doneWhen is not met yet
 */

const AGENTS = ["Researcher", "Builder", "Reviewer", "Publisher"];
const STATUSES = ["queued", "running", "handoff", "done"];
const INTENT_RANK = { Publisher: 0, Reviewer: 1, Builder: 2, Researcher: 3 };

const STOP_WORDS = new Set(
  "a an the and or but for with from into onto of to in on at by as is are was were been being be this that those these your their its not when then than over under about across have has had does do did will would should must can may done".split(
    " "
  )
);

const REVIEWER_RE =
  /\b(?:check(?:ing)?\s+(?:the\s+)?quality|quality\s+(?:check|review)|(?:writ(?:e|ing)|draft(?:ing)?|author(?:ing)?|prepar(?:e|ing))\s+a\s+comparison|code review|auditing|audit|review(?:ing)?)\b/;
const BUILDER_RE =
  /\b(?:implement(?:ing|ation|ed)?|fix(?:ing|es|ed)?|refactor(?:ing|ed)?|bugfix|bug|patch(?:ing)?|debug(?:ging)?|(?:write|add|create)\s+(?:a\s+)?(?:function|module|endpoint|component|test|script))\b/;
const RESEARCHER_RE =
  /\b(?:gather(?:ing|ed)?|research(?:ing|ed)?|investigat(?:e|ing|ion|ed)|explor(?:e|ing|ed)|compar(?:e|ing|ed))\b/;
const COMPARISON_RE =
  /\b(?:writ(?:e|ing)|draft(?:ing)?|author(?:ing)?|prepar(?:e|ing))\s+a\s+comparison\b/;
const PUBLISHER_NOUN_RE =
  /\b(?:submit text|submission|screenshots?|repo links?|repository links?|github links?)\b/;
const PUBLISHER_VERB_RE = /\b(?:package|packaging|publish(?:ing)?|assemble|bundle|prepare)\b/;

function planAgentHandoff(task) {
  const normalized = normalizeTask(task);
  const primaryAgent = chooseAgent(normalized);
  const nextStatus = chooseStatus(normalized);
  return {
    primaryAgent,
    nextStatus,
    checklist: buildChecklist(normalized, primaryAgent),
    handoffNote: buildHandoffNote(normalized, primaryAgent, nextStatus),
  };
}

function normalizeTask(task) {
  const source = task && typeof task === "object" ? task : {};
  return {
    goal: asText(source.goal),
    doneWhen: asText(source.doneWhen),
    constraints: asList(source.constraints),
    artifacts: asList(source.artifacts),
  };
}

function chooseAgent(task) {
  return intentIn(task.goal) || intentIn(task.doneWhen) || "Researcher";
}

function intentIn(text) {
  const body = text.toLowerCase();
  if (!body.trim()) return null;

  const hits = [];
  const publisherAt = publisherIndex(body);
  if (publisherAt >= 0) hits.push(["Publisher", publisherAt]);

  const reviewerAt = body.search(REVIEWER_RE);
  if (reviewerAt >= 0) hits.push(["Reviewer", reviewerAt]);

  const builderAt = body.search(BUILDER_RE);
  if (builderAt >= 0) hits.push(["Builder", builderAt]);

  // "compare" is research. "write a comparison" is a review, so it wins.
  const researcherAt = body.search(RESEARCHER_RE);
  if (researcherAt >= 0 && !COMPARISON_RE.test(body)) hits.push(["Researcher", researcherAt]);

  if (hits.length === 0) return null;
  hits.sort((left, right) => left[1] - right[1] || INTENT_RANK[left[0]] - INTENT_RANK[right[0]]);
  return hits[0][0];
}

function publisherIndex(body) {
  const nounAt = body.search(PUBLISHER_NOUN_RE);
  if (nounAt < 0) return -1;
  const verbAt = body.search(PUBLISHER_VERB_RE);
  if (verbAt < 0) return nounAt;
  return Math.min(verbAt, nounAt);
}

function chooseStatus(task) {
  if (doneSatisfied(task)) return "done";
  if (task.artifacts.length === 0) return inProgress(task) ? "running" : "queued";
  if (inProgress(task) || hasDraftArtifact(task)) return "running";
  return "handoff";
}

function inProgress(task) {
  return task.constraints.some((item) => {
    const text = item.toLowerCase();
    if (/\bnot\b.{0,16}\b(in progress|wip|still working)\b/.test(text)) return false;
    return /\b(in progress|work in progress|wip|still working)\b/.test(text);
  });
}

function hasDraftArtifact(task) {
  return task.artifacts.some((artifact) => /\b(draft|wip|partial|scratch|tmp)\b/i.test(artifact));
}

function doneSatisfied(task) {
  const have = new Set(contentWords(task.artifacts.join(" ")));
  if (have.size === 0) return false;

  const needed = contentWords(task.doneWhen);
  if (needed.length === 0) return false;

  const hits = needed.filter((word) => hasWord(have, word));
  return hits.length / needed.length >= 0.6;
}

function buildChecklist(task, agent) {
  const goal = clause(task.goal, "the lab task");
  const doneWhen = clause(task.doneWhen, "the done condition");
  const constraints = task.constraints.map((item) => clause(item, "")).filter(Boolean);
  const artifact = task.artifacts.map((item) => clause(item, "")).find(Boolean);
  const constraintStep = constraints[0]
    ? `Follow the constraint "${constraints[0]}"`
    : null;

  const steps = {
    Researcher: [
      `Gather the sources this goal names: ${goal}`,
      constraintStep || "List the facts that are still missing before drawing a conclusion",
      "Compare those sources and note the differences that matter for the goal",
      `Write the notes that satisfy: ${doneWhen}`,
    ],
    Builder: [
      `Implement the change this goal describes: ${goal}`,
      constraintStep || "Limit the diff to the module this task owns",
      artifact
        ? `Update ${artifact} and re-run the check this goal depends on`
        : "Add the missing code and run it once locally",
      `Leave the task only once this is true: ${doneWhen}`,
    ],
    Reviewer: [
      `Check the result against the goal: ${goal}`,
      constraintStep || "Look for correctness gaps and missing edge cases",
      artifact
        ? `Write a comparison that cites ${artifact}`
        : "Write a comparison of the result versus the lab rubric",
      `Close the review when this is true: ${doneWhen}`,
    ],
    Publisher: [
      `Draft the submit text for: ${goal}`,
      constraintStep || "Keep the submit text short enough for the lab form",
      publisherAttachStep(task),
      `Package the pieces so this is true: ${doneWhen}`,
    ],
  }[agent];

  if (constraints[1]) steps.splice(2, 0, `Also follow the constraint "${constraints[1]}"`);

  const concrete = steps.map((step) => step.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (concrete.length <= 5) return concrete;
  return concrete.slice(0, 4).concat(concrete[concrete.length - 1]);
}

function publisherAttachStep(task) {
  const blob = `${task.goal} ${task.doneWhen} ${task.constraints.join(" ")}`.toLowerCase();
  const shots = /\bscreenshots?\b/.test(blob);
  const link = /\b(?:repo|repository|github)\s+links?\b/.test(blob);
  if (shots && link) return "Attach the screenshots and the repo link this task asks for";
  if (shots) return "Attach the screenshots this task asks for and check they show the finished flow";
  if (link) return "Copy the repo link and confirm it opens the branch with the finished work";
  return "Assemble the submit text and the files the lab form requires";
}

function buildHandoffNote(task, agent, status) {
  const goal = clause(task.goal, "the task");
  const nextAgent = {
    Researcher: "the Builder",
    Builder: "the Reviewer",
    Reviewer: "the Publisher",
    Publisher: "the lab form",
  }[agent];

  const line = {
    queued: `${agent} should start this task: ${goal}`,
    running: `${agent} is still working this task: ${goal}`,
    handoff: `${agent} is ready to hand this task to ${nextAgent}: ${goal}`,
    done: `${agent} met the done condition for this task: ${goal}`,
  }[status];

  return `${line}.`;
}

function contentWords(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));
}

function hasWord(words, token) {
  if (words.has(token)) return true;
  if (token.endsWith("s") && words.has(token.slice(0, -1))) return true;
  if (words.has(`${token}s`)) return true;
  return false;
}

function asText(value) {
  return typeof value === "string" ? value : "";
}

function asList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string");
}

function clause(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[.?!]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= 180) return cleaned;
  return cleaned.slice(0, 177).trimEnd();
}

function isOneSentence(note) {
  if (typeof note !== "string") return false;
  const body = note.trim();
  if (!body.endsWith(".")) return false;
  return !/[.!?]/.test(body.slice(0, -1));
}

function validHandoff(result) {
  if (!result || typeof result !== "object") return false;
  if (!AGENTS.includes(result.primaryAgent)) return false;
  if (!STATUSES.includes(result.nextStatus)) return false;
  if (!Array.isArray(result.checklist)) return false;
  if (result.checklist.length < 3 || result.checklist.length > 5) return false;
  if (!result.checklist.every((step) => typeof step === "string" && step.trim().length > 0)) {
    return false;
  }
  return isOneSentence(result.handoffNote);
}

const researchTask = planAgentHandoff({
  goal: "Gather public docs and compare Pinecone, Weaviate, and pgvector for the Multi-Agent Lab retrieval layer",
  constraints: ["Public docs only", "No vendor calls"],
  artifacts: [],
  doneWhen: "Notes list latency, pricing, and a recommended option",
});

const builderTask = planAgentHandoff({
  goal: "Implement planAgentHandoff and fix the status bug when artifacts exist but doneWhen is unmet",
  constraints: ["Keep the change in one file", "Do not add dependencies"],
  artifacts: ["benchmarks/grok-4.7.js"],
  doneWhen: "Node assert suite passes for queued, handoff, and done",
});

const publisherTask = planAgentHandoff({
  goal: "Package the submit text, screenshots, and repo link for the Multi-Agent Lab entry",
  constraints: ["One paragraph of submit text", "Include desktop and mobile screenshots"],
  artifacts: [
    "dist/submit-text-final.md",
    "dist/screenshots/desktop.png",
    "dist/screenshots/mobile.png",
    "dist/repo-link.txt",
  ],
  doneWhen: "Submit text, screenshots, and the repo link are packaged in dist",
});

const researchOk =
  validHandoff(researchTask) &&
  researchTask.primaryAgent === "Researcher" &&
  researchTask.nextStatus === "queued";
const builderOk =
  validHandoff(builderTask) &&
  builderTask.primaryAgent === "Builder" &&
  builderTask.nextStatus === "handoff";
const publisherOk =
  validHandoff(publisherTask) &&
  publisherTask.primaryAgent === "Publisher" &&
  publisherTask.nextStatus === "done";

console.assert(
  researchOk,
  "Researcher is queued when the lab still needs sources and no artifacts exist"
);
console.assert(
  builderOk,
  "Builder hands off once the router file exists and the assert suite is still unmet"
);
console.assert(
  publisherOk,
  "Publisher is done once submit text, screenshots, and the repo link are packaged"
);

if (!(researchOk && builderOk && publisherOk)) {
  process.exitCode = 1;
} else {
  console.log("planAgentHandoff: 3 asserts passed");
}

module.exports = { planAgentHandoff };
