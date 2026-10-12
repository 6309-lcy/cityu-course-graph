# CityU Course Knowledge Graphs (multi-course hub)

Shared box frontend for **City University of Hong Kong** course bots. Hub lists courses; each bot owns `courses/<id>/graph.json`. All course pages use a shared **ASCII knowledge-graph viewer** (GrokDay light theme).

## Hub & API

| What | URL / path |
|------|------------|
| Hub UI (local) | http://127.0.0.1:8765/ |
| Catalog JSON (local) | http://127.0.0.1:8765/courses.json |
| Hub UI (GitHub Pages) | https://6309-lcy.github.io/cityu-course-graph/ |
| Catalog JSON (Pages) | https://6309-lcy.github.io/cityu-course-graph/courses.json |
| Compat graph (CS4487) | local `http://127.0.0.1:8765/graph.json` · Pages `https://6309-lcy.github.io/cityu-course-graph/graph.json` (real file copy of `courses/cs4487/graph.json`) |
| Box root | `/workspace/cityu-course-graph/` |
| Shared viewer | `shared/ascii-graph.js` + `shared/grokday.css` |
| Pages base | `https://6309-lcy.github.io/cityu-course-graph` |

```bash
cd /workspace/cityu-course-graph
python3 -m http.server 8765 --bind 127.0.0.1
```

HTML links are **relative** (`./courses/…`, `../`, `../../shared/…`) so the site works on GitHub Pages project sites (no absolute `/courses/` or `/shared/`).

## Courses

| id | Title | Status | UI | Graph |
|----|-------|--------|----|-------|
| cs4487 | CS4487/CS5489 Machine Learning | ready (ASCII UI) | `/courses/cs4487/` | `/courses/cs4487/graph.json` |
| cs3103 | CS3103 Operating Systems | ready (ASCII UI) | `/courses/cs3103/` | `/courses/cs3103/graph.json` |
| cs4187 | CS4187 Computer Vision for Interactivity | ready (ASCII UI) | `/courses/cs4187/` | `/courses/cs4187/graph.json` |
| cs6382 | CS6382 Advanced Algo Design and Game Theory | ready (ASCII UI) | `/courses/cs6382/` | `/courses/cs6382/graph.json` |
| cs5486 | CS5486 Intelligent Systems | stub (empty graph) | `/courses/cs5486/` | `/courses/cs5486/graph.json` |

## For owning bots

1. Edit `courses/<id>/graph.json` with schema `{meta, groups, edgeKinds, nodes, edges}`.
2. Optional: set `meta.asciiColumns` to `[{title, groups:[]}, …]` for custom L→R columns. If omitted, the viewer derives one column per group key (practice last).
3. Open `http://127.0.0.1:8765/courses/<id>/` — the shell loads `../../shared/ascii-graph.js` and fetches `./graph.json`.
4. Set `meta.status` to `ready` when populated.

## Column layout

- Prefer `meta.asciiColumns` when present.
- Else: one column per key in `groups` (object insertion order), with `practice` moved last.
