const STORAGE_KEY = "mal-handoff-board-v1";
const STATUSES = ["queued", "running", "handoff", "done"];
const NEXT = { queued: "running", running: "handoff", handoff: "done" };

const DEMO = [
  {
    id: "demo-1",
    goal: "Pull GHW Builders challenge list and rank by points-per-effort",
    agent: "Researcher",
    priority: "P0",
    notes: "No login needed for listing; mark Auth0 RAG as skip",
    status: "done",
    createdAt: Date.now() - 3600000
  },
  {
    id: "demo-2",
    goal: "Scaffold Agent Handoff Board mini app for Challenge 1",
    agent: "Builder",
    priority: "P0",
    notes: "Single-page, no API keys, screenshot when running",
    status: "running",
    createdAt: Date.now() - 1800000
  },
  {
    id: "demo-3",
    goal: "Draft Challenge 2 model-comparison prompt pack for Kuanpo",
    agent: "Reviewer",
    priority: "P1",
    notes: "Do not fabricate Cursor model results",
    status: "queued",
    createdAt: Date.now() - 600000
  },
  {
    id: "demo-4",
    goal: "Hand finished Challenge 1 artifacts to Publisher for MLH submit notes",
    agent: "Publisher",
    priority: "P1",
    notes: "Kuanpo submits himself — prepare paths + 2-sentence blurb only",
    status: "handoff",
    createdAt: Date.now() - 120000
  }
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEMO);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : structuredClone(DEMO);
  } catch {
    return structuredClone(DEMO);
  }
}

function save(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

let tasks = load();

const form = document.getElementById("taskForm");
const statsEl = document.getElementById("stats");
const clockEl = document.getElementById("clock");
const themeBtn = document.getElementById("themeBtn");
const resetBtn = document.getElementById("resetBtn");

function uid() {
  return "t-" + Math.random().toString(36).slice(2, 9);
}

function render() {
  for (const status of STATUSES) {
    const col = document.getElementById("col-" + status);
    col.innerHTML = "";
    const items = tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.priority.localeCompare(b.priority) || b.createdAt - a.createdAt);
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "notes";
      empty.textContent = "Empty";
      col.appendChild(empty);
      continue;
    }
    for (const task of items) col.appendChild(cardEl(task));
  }

  statsEl.innerHTML = STATUSES.map((s) => {
    const n = tasks.filter((t) => t.status === s).length;
    return `<span class="chip">${s}: ${n}</span>`;
  }).join("");
}

function cardEl(task) {
  const el = document.createElement("article");
  el.className = "card";
  el.innerHTML = `
    <div class="goal"></div>
    <div class="meta">
      <span class="badge agent"></span>
      <span class="badge ${task.priority}"></span>
    </div>
    <div class="notes"></div>
    <div class="actions"></div>
  `;
  el.querySelector(".goal").textContent = task.goal;
  el.querySelector(".badge.agent").textContent = task.agent;
  el.querySelector(`.badge.${task.priority}`).textContent = task.priority;
  el.querySelector(".notes").textContent = task.notes || "No handoff notes";

  const actions = el.querySelector(".actions");
  if (NEXT[task.status]) {
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = "→ " + NEXT[task.status];
    next.addEventListener("click", () => move(task.id, NEXT[task.status]));
    actions.appendChild(next);
  }
  if (task.status !== "queued") {
    const back = document.createElement("button");
    back.type = "button";
    back.textContent = "← back";
    const prev = STATUSES[STATUSES.indexOf(task.status) - 1];
    back.addEventListener("click", () => move(task.id, prev));
    actions.appendChild(back);
  }
  const del = document.createElement("button");
  del.type = "button";
  del.className = "danger";
  del.textContent = "Delete";
  del.addEventListener("click", () => {
    tasks = tasks.filter((t) => t.id !== task.id);
    save(tasks);
    render();
  });
  actions.appendChild(del);
  return el;
}

function move(id, status) {
  tasks = tasks.map((t) => (t.id === id ? { ...t, status } : t));
  save(tasks);
  render();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const goal = document.getElementById("goal").value.trim();
  const agent = document.getElementById("agent").value;
  const priority = document.getElementById("priority").value;
  const notes = document.getElementById("notes").value.trim();
  tasks.unshift({ id: uid(), goal, agent, priority, notes, status: "queued", createdAt: Date.now() });
  save(tasks);
  form.reset();
  document.getElementById("priority").value = "P1";
  render();
});

resetBtn.addEventListener("click", () => {
  tasks = structuredClone(DEMO);
  save(tasks);
  render();
});

themeBtn.addEventListener("click", () => {
  const next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
  if (next === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
  localStorage.setItem(STORAGE_KEY + "-theme", next);
});

(function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY + "-theme");
  if (saved === "light") document.documentElement.setAttribute("data-theme", "light");
})();

function tick() {
  clockEl.textContent = new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}
tick();
setInterval(tick, 15000);
render();
