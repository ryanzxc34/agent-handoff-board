# Agent Handoff Board

A tiny Multi-Agent Lab planner: capture a goal, assign a specialist agent (Researcher / Builder / Reviewer / Publisher), and move work across Queued → Running → Handoff → Done.

Built for **MLH Global Hack Week: Builders Week — Challenge 1** with Cursor scaffolding and iteration. Pure static HTML/CSS/JS — open `index.html` or serve the folder; no API keys, no backend.

## Run

```bash
# Option A: open the file
open index.html   # or double-click

# Option B: local static server
python3 -m http.server 8765 --directory .
# then visit http://127.0.0.1:8765
```

## Features

- Add tasks with goal, agent role, priority, and handoff notes
- Kanban columns with advance / back / delete
- Demo seed data + Reset demo
- Dark / light theme toggle
- Persists to `localStorage` in the browser

## MLH two-sentence description (Challenge 1 submit)

Cursor helped me scaffold a single-page Agent Handoff Board for my Multi-Agent Lab theme, with a task form, four-column kanban, and localStorage persistence. I used Cursor to iterate on layout, dark/light theme, and the advance/back handoff controls until the board ran cleanly with no backend or API keys.

## Screenshot

![Agent Handoff Board](screenshots/challenge1-handoff-board-wide.png)
