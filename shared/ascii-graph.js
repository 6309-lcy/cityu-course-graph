/**
 * Shared ASCII knowledge-graph viewer (GrokDay).
 * Works with any graph.json: {meta, groups, edgeKinds, nodes, edges}.
 * Columns: meta.asciiColumns if present, else one column per group (practice last).
 */
(function () {
  "use strict";

  const EDGE_GLYPH = {
    uses_math: "~>",
    specializes: "=>",
    alternative_to: "<>",
    leads_to: "->",
    assessed_by: "##",
    shares_geometry: "==",
    map_view: "~~",
    requires: "#>",
    causes: "*>",
    protects: "@@",
    proved_by: ":>",
    complements: "~+",
    contrasts: "<>",
  };

  let graph = null;
  let asciiPlain = "";
  let selectedId = null;
  let editMode = false;
  let layerOrder = [];

  const $ascii = document.getElementById("ascii");
  const $detail = document.getElementById("detail");
  const $status = document.getElementById("status");
  const $search = document.getElementById("search");
  const $goto = document.getElementById("goto");
  const $fontsize = document.getElementById("fontsize");
  const $datalist = document.getElementById("node-ids");
  const $courseTitle = document.getElementById("course-title");
  const $footerApi = document.getElementById("footer-api");

  if ($ascii) {
    asciiPlain = ($ascii.textContent || "").replace(/\u00a0/g, " ");
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pad(s, n, ch) {
    s = String(s);
    ch = ch || " ";
    if (s.length >= n) return s.slice(0, n);
    return s + ch.repeat(n - s.length);
  }

  function center(s, n) {
    s = String(s);
    if (s.length >= n) return s.slice(0, n);
    const left = Math.floor((n - s.length) / 2);
    return " ".repeat(left) + s + " ".repeat(n - s.length - left);
  }

  function boxWidth(nodes) {
    let w = 12;
    for (const n of nodes) {
      w = Math.max(w, (n.label || "").length + 2, (n.id || "").length + 2);
    }
    return Math.min(Math.max(w, 16), 28);
  }

  function makeBoxLines(node, bw) {
    const top = "+" + "-".repeat(bw) + "+";
    const mid1 = "|" + center(node.label, bw) + "|";
    const mid2 = "|" + center("[" + node.id + "]", bw) + "|";
    const bot = "+" + "-".repeat(bw) + "+";
    return { top, mid1, mid2, bot, id: node.id, label: node.label, group: node.group };
  }

  /** Prefer meta.asciiColumns; else one column per group key (practice last). */
  function deriveColumns(g) {
    const metaCols = g.meta && Array.isArray(g.meta.asciiColumns) ? g.meta.asciiColumns : null;
    if (metaCols && metaCols.length) {
      return metaCols.map(function (c, i) {
        return {
          key: "col" + i,
          title: String(c.title || ("COL" + (i + 1))).toUpperCase(),
          groups: Array.isArray(c.groups) ? c.groups.slice() : [],
        };
      });
    }
    const groups = g.groups || {};
    const keys = Object.keys(groups);
    const practice = keys.filter(function (k) { return k === "practice"; });
    const others = keys.filter(function (k) { return k !== "practice"; });
    return others.concat(practice).map(function (k) {
      const label = (groups[k] && groups[k].label) || k;
      return {
        key: k,
        title: String(label).toUpperCase().slice(0, 28),
        groups: [k],
      };
    });
  }

  function layerForGroup(gid) {
    for (let i = 0; i < layerOrder.length; i++) {
      if (layerOrder[i].groups.indexOf(gid) !== -1) return i;
    }
    return Math.max(0, Math.floor(layerOrder.length / 2));
  }

  function layersLine(layers) {
    if (!layers.length) return "(no columns)";
    return layers.map(function (L) { return L.title; }).join(" -> ");
  }

  function buildAscii(g) {
    layerOrder = deriveColumns(g);
    const nodes = Array.isArray(g.nodes) ? g.nodes : [];
    const edges = Array.isArray(g.edges) ? g.edges : [];

    const layers = layerOrder.map(function (L) {
      const colNodes = nodes.filter(function (n) { return L.groups.indexOf(n.group) !== -1; });
      colNodes.sort(function (a, b) {
        const gi = L.groups.indexOf(a.group) - L.groups.indexOf(b.group);
        return gi !== 0 ? gi : String(a.label || "").localeCompare(String(b.label || ""));
      });
      return Object.assign({}, L, { nodes: colNodes });
    });

    // Orphan nodes (group not in any column) — append to last non-practice column or first
    const covered = {};
    layers.forEach(function (L) {
      L.groups.forEach(function (gid) { covered[gid] = true; });
    });
    const orphans = nodes.filter(function (n) { return !covered[n.group]; });
    if (orphans.length) {
      if (!layers.length) {
        layers.push({ key: "other", title: "OTHER", groups: [], nodes: orphans });
      } else {
        let target = layers[0];
        for (let i = layers.length - 1; i >= 0; i--) {
          if (layers[i].groups.indexOf("practice") === -1) { target = layers[i]; break; }
        }
        target.nodes = target.nodes.concat(orphans);
      }
    }

    const courseName = (g.meta && g.meta.course) || "Course";
    const institution = (g.meta && g.meta.institution) || "";
    const layerStr = layersLine(layers);

    if (!nodes.length) {
      const stub = [
        "+==============================================================================+",
        "|  " + pad(courseName + " — ASCII Knowledge Graph", 74) + "|",
        "|  " + pad(institution, 74) + "|",
        "|  " + pad("Status: empty graph — add nodes/edges to graph.json", 74) + "|",
        "|  Click [node_id] for detail · Search filters · Regenerate reloads graph.json |",
        "+==============================================================================+",
        "",
        "        (no nodes)                      (no edges)",
        "",
        "   +-------------------+          +----------------------+",
        "   |   awaiting data   | - - - -> |  fill graph.json     |",
        "   |   [placeholder]   |          |  [owning_bot]        |",
        "   +-------------------+          +----------------------+",
        "",
        "Updated: " + ((g.meta && g.meta.updated) || "") + " · Source: graph.json",
      ].join("\n");
      return { plain: stub, place: {}, layers: layers, widths: [], colX: [], boxes: [] };
    }

    const widths = layers.map(function (L) { return boxWidth(L.nodes); });
    const GAP = 10;
    const BOX_H = 4;
    const ROW_GAP = 1;
    const boxes = layers.map(function (L, li) {
      return L.nodes.map(function (n) { return makeBoxLines(n, widths[li]); });
    });

    const colX = [];
    let xAcc = 0;
    for (let i = 0; i < layers.length; i++) {
      colX.push(xAcc);
      xAcc += widths[i] + 2 + GAP;
    }
    const totalW = Math.max(xAcc - GAP, 40);

    const place = {};
    for (let c = 0; c < boxes.length; c++) {
      let y = 0;
      for (let r = 0; r < boxes[c].length; r++) {
        place[boxes[c][r].id] = { col: c, row: r, y: y, bw: widths[c], x: colX[c] };
        y += BOX_H + ROW_GAP;
      }
    }

    let maxH = 1;
    Object.keys(place).forEach(function (id) {
      maxH = Math.max(maxH, place[id].y + BOX_H);
    });

    const contentTop = 2;
    const gridH = contentTop + maxH + 2;
    const gridW = Math.max(totalW + 2, 90);
    const grid = Array.from({ length: gridH }, function () { return Array(gridW).fill(" "); });
    const blocked = Array.from({ length: gridH }, function () { return Array(gridW).fill(false); });

    function put(row, col, str, block) {
      if (row < 0 || row >= gridH) return;
      const s = String(str);
      for (let i = 0; i < s.length; i++) {
        const c = col + i;
        if (c >= 0 && c < gridW) {
          grid[row][c] = s[i];
          if (block) blocked[row][c] = true;
        }
      }
    }

    function putEdge(row, col, ch) {
      if (row < 0 || row >= gridH || col < 0 || col >= gridW) return;
      if (blocked[row][col]) return;
      const cur = grid[row][col];
      if (cur === " ") grid[row][col] = ch;
      else if ((cur === "-" || cur === "|") && (ch === "-" || ch === "|") && cur !== ch) {
        grid[row][col] = "+";
      }
    }

    for (let c = 0; c < layers.length; c++) {
      put(0, colX[c], center(layers[c].title, widths[c] + 2), false);
    }

    for (let c = 0; c < boxes.length; c++) {
      for (let r = 0; r < boxes[c].length; r++) {
        const b = boxes[c][r];
        const y0 = contentTop + place[b.id].y;
        const x0 = colX[c];
        put(y0, x0, b.top, true);
        put(y0 + 1, x0, b.mid1, true);
        put(y0 + 2, x0, b.mid2, true);
        put(y0 + 3, x0, b.bot, true);
      }
    }

    const edgeKindsUsed = {};
    const drawnEdgeNotes = [];

    const forward = edges.filter(function (e) {
      const fr = place[e.from], to = place[e.to];
      return fr && to && fr.col < to.col;
    }).slice().sort(function (a, b) {
      const fa = place[a.from], fb = place[b.from];
      return fa.col - fb.col || fa.y - fb.y || place[a.to].y - place[b.to].y;
    });

    for (let i = 0; i < forward.length; i++) {
      const e = forward[i];
      const fr = place[e.from], to = place[e.to];
      edgeKindsUsed[e.kind] = true;
      const glyph = EDGE_GLYPH[e.kind] || "->";
      const srcY = contentTop + fr.y + 1;
      const dstY = contentTop + to.y + 1;
      const xLeft = fr.x + fr.bw + 2;
      const xRight = to.x - 1;
      if (xRight <= xLeft) continue;
      const bendX = to.x - 2;
      putEdge(srcY, xLeft, glyph.charAt(0) === "<" || glyph.charAt(0) === ">" ? "-" : glyph.charAt(0));
      if (srcY === dstY) {
        for (let xi = xLeft; xi < xRight; xi++) putEdge(srcY, xi, "-");
        putEdge(dstY, xRight, ">");
      } else {
        for (let xi = xLeft + 1; xi < bendX; xi++) putEdge(srcY, xi, "-");
        putEdge(srcY, bendX, "+");
        const yLo = Math.min(srcY, dstY), yHi = Math.max(srcY, dstY);
        for (let yi = yLo + 1; yi < yHi; yi++) putEdge(yi, bendX, "|");
        putEdge(dstY, bendX, "+");
        for (let xi = bendX + 1; xi < xRight; xi++) putEdge(dstY, xi, "-");
        putEdge(dstY, xRight, ">");
      }
      drawnEdgeNotes.push({
        line: "  " + pad(e.from, 16) + " " + pad(glyph, 3) + " " + pad(e.to, 16) +
          "  [" + e.kind + "]" + (e.label ? "  " + e.label : ""),
        from: e.from, to: e.to, kind: e.kind,
      });
    }

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      const fr = place[e.from], to = place[e.to];
      if (!fr || !to || fr.col < to.col) continue;
      edgeKindsUsed[e.kind] = true;
      const glyph = EDGE_GLYPH[e.kind] || "->";
      const tag = fr.col > to.col ? " (back)" : " (same-col)";
      drawnEdgeNotes.push({
        line: "  " + pad(e.from, 16) + " " + pad(glyph, 3) + " " + pad(e.to, 16) +
          "  [" + e.kind + "]" + tag + (e.label ? "  " + e.label : ""),
        from: e.from, to: e.to, kind: e.kind,
      });
    }

    const mapLines = grid.map(function (row) { return row.join("").replace(/\s+$/, ""); });

    const header = [
      "+==============================================================================+",
      "|  " + pad(courseName + " — ASCII Knowledge Graph", 74) + "|",
      "|  " + pad(institution, 74) + "|",
      "|  " + pad("Layers L->R: " + layerStr, 74) + "|",
      "|  Click [node_id] for detail · Search filters · Regenerate reloads graph.json |",
      "+==============================================================================+",
      "",
    ];

    const legend = [
      "",
      "---- EDGE LEGEND ---------------------------------------------------------------",
    ];
    const kinds = g.edgeKinds || {};
    Object.keys(kinds).forEach(function (kind) {
      const gly = EDGE_GLYPH[kind] || "->";
      const mark = edgeKindsUsed[kind] ? "*" : " ";
      const desc = typeof kinds[kind] === "string" ? kinds[kind] : (kinds[kind] && kinds[kind].label) || "";
      legend.push("  " + mark + " " + pad(gly, 3) + "  " + pad(kind, 18) + "  " + desc);
    });
    legend.push("  (* = used in this graph)");
    legend.push("");
    legend.push("---- GROUPS --------------------------------------------------------------------");
    const groups = g.groups || {};
    Object.keys(groups).forEach(function (gid) {
      const layer = layerOrder.find(function (L) { return L.groups.indexOf(gid) !== -1; });
      const glabel = (groups[gid] && groups[gid].label) || gid;
      legend.push(
        "  " + pad(gid, 16) + "  " + pad(glabel, 32) +
        "  col=" + (layer ? layer.title : "?")
      );
    });
    legend.push("");
    legend.push("---- ALL EDGES (full list; map shows forward connectors) -----------------------");
    drawnEdgeNotes.forEach(function (n) { legend.push(n.line); });
    legend.push("");
    legend.push("---- NODE INDEX ----------------------------------------------------------------");
    nodes.forEach(function (n) {
      legend.push(
        "  " + pad("[" + n.id + "]", 22) + "  " + pad(n.label, 28) +
        "  " + pad(n.group, 14) + "  L" + (n.lecture != null ? n.lecture : "")
      );
    });
    legend.push("");
    legend.push("Updated: " + ((g.meta && g.meta.updated) || "") + " · Source: graph.json");

    return {
      plain: header.concat(mapLines).concat(legend).join("\n"),
      place: place,
      layers: layers,
      widths: widths,
      colX: colX,
      boxes: boxes,
    };
  }

  function renderAscii(plain, filter) {
    asciiPlain = plain;
    const q = (filter || "").trim().toLowerCase();
    const lines = plain.split("\n");

    const matchIds = new Set();
    if (q && graph) {
      (graph.nodes || []).forEach(function (n) {
        const blob = (n.id + " " + n.label + " " + n.group + " " + n.lecture + " " + n.detail).toLowerCase();
        if (blob.indexOf(q) !== -1) matchIds.add(n.id);
      });
      (graph.edges || []).forEach(function (e) {
        if ((e.kind + " " + (e.label || "")).toLowerCase().indexOf(q) !== -1) {
          matchIds.add(e.from);
          matchIds.add(e.to);
        }
      });
    }

    let html = "";
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      let dim = false;
      if (q) {
        const lower = line.toLowerCase();
        const lineMatch = lower.indexOf(q) !== -1;
        let hasMatchId = false;
        const idRe = /\[([a-z0-9_]+)\]/g;
        let m;
        while ((m = idRe.exec(line)) !== null) {
          if (matchIds.has(m[1])) { hasMatchId = true; break; }
        }
        dim = !lineMatch && !hasMatchId && line.trim() !== "";
      }

      let out = "";
      let last = 0;
      const re = /\[([a-z0-9_]+)\]/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        out += decorateSegment(line.slice(last, m.index), q);
        const nid = m[1];
        const known = graph && (graph.nodes || []).some(function (n) { return n.id === nid; });
        if (known) {
          const sel = nid === selectedId ? " selected" : "";
          const hl = q && matchIds.has(nid) ? " match-hl" : "";
          out += '<span class="node-id' + sel + hl + '" data-id="' + esc(nid) + '">[' + esc(nid) + "]</span>";
        } else {
          out += esc(m[0]);
        }
        last = m.index + m[0].length;
      }
      out += decorateSegment(line.slice(last), q);

      const cls = dim ? ' class="dimmed"' : "";
      html += "<span" + cls + ">" + out + "</span>\n";
    }

    if (editMode) {
      $ascii.contentEditable = "true";
      $ascii.classList.add("edit-mode");
      $ascii.textContent = plain;
    } else {
      $ascii.contentEditable = "false";
      $ascii.classList.remove("edit-mode");
      $ascii.innerHTML = html;
    }
  }

  function decorateSegment(seg, q) {
    if (!seg) return "";
    let s = esc(seg);
    s = s.replace(/([+|\\\-]+)/g, function (m) {
      if (/^[+\-|\\]+$/.test(m) && m.length >= 2) {
        return '<span class="box-line">' + m + "</span>";
      }
      return m;
    });
    if (q && seg.toLowerCase().indexOf(q) !== -1) {
      const re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      s = s.replace(re, '<span class="match-hl">$1</span>');
    }
    return s;
  }

  function showDetail(id) {
    if (!graph) return;
    const node = (graph.nodes || []).find(function (n) { return n.id === id; });
    if (!node) {
      $detail.innerHTML = '<p id="empty">Unknown id: <code>' + esc(id) + "</code></p>";
      return;
    }
    selectedId = id;
    const ginfo = (graph.groups && graph.groups[node.group]) || { label: node.group, color: "#7D4BC6" };
    const outs = (graph.edges || []).filter(function (e) { return e.from === id; });
    const inns = (graph.edges || []).filter(function (e) { return e.to === id; });

    let html = "";
    html += "<h2>" + esc(node.label) + "</h2>";
    html += '<div class="id-tag">[' + esc(node.id) + "]</div>";
    html += '<div class="meta">';
    html += '<span class="badge" style="--gcolor:' + esc(ginfo.color || "#7D4BC6") + '">' +
      esc(ginfo.label || node.group) + "</span> · Lecture " + esc(node.lecture != null ? node.lecture : "?");
    html += "</div>";
    html += '<p class="blurb">' + esc(node.detail || "") + "</p>";

    html += '<h3 style="margin:8px 0 4px;font-size:0.8rem;color:var(--bright)">Outgoing</h3>';
    if (!outs.length) html += '<p class="meta">(none)</p>';
    else {
      html += '<ul id="edges-list">';
      outs.forEach(function (e) {
        const t = (graph.nodes || []).find(function (n) { return n.id === e.to; });
        html += "<li><span class=\"kind\">" + esc(e.kind) + "</span> → <strong data-id=\"" +
          esc(e.to) + "\">" + esc(t ? t.label : e.to) + "</strong>" +
          (e.label ? " <span class=\"meta\">(" + esc(e.label) + ")</span>" : "") + "</li>";
      });
      html += "</ul>";
    }

    html += '<h3 style="margin:8px 0 4px;font-size:0.8rem;color:var(--bright)">Incoming</h3>';
    if (!inns.length) html += '<p class="meta">(none)</p>';
    else {
      html += '<ul id="edges-list">';
      inns.forEach(function (e) {
        const t = (graph.nodes || []).find(function (n) { return n.id === e.from; });
        html += "<li><span class=\"kind\">" + esc(e.kind) + "</span> ← <strong data-id=\"" +
          esc(e.from) + "\">" + esc(t ? t.label : e.from) + "</strong>" +
          (e.label ? " <span class=\"meta\">(" + esc(e.label) + ")</span>" : "") + "</li>";
      });
      html += "</ul>";
    }

    $detail.innerHTML = html;
    if (!editMode) renderAscii(asciiPlain, $search.value);
  }

  function fillDatalist() {
    $datalist.innerHTML = "";
    if (!graph) return;
    (graph.nodes || []).forEach(function (n) {
      const opt = document.createElement("option");
      opt.value = n.id;
      opt.label = n.label;
      $datalist.appendChild(opt);
    });
  }

  function updateChrome(g) {
    const course = (g.meta && g.meta.course) || "Course";
    document.title = course + " — Course Knowledge Graph (ASCII · GrokDay)";
    if ($courseTitle) $courseTitle.textContent = course + " ASCII Graph";
    const cols = deriveColumns(g);
    const empty = document.getElementById("empty");
    if (empty && !(g.nodes || []).length) {
      empty.innerHTML =
        "Empty graph. Edit <code>graph.json</code> to add nodes/edges.<br /><br />" +
        "Schema: meta, groups, edgeKinds, nodes[], edges[].<br /><br />" +
        "Select/copy freely once populated.";
    } else if (empty && !selectedId) {
      empty.innerHTML =
        'Click a <span style="color:var(--accent)">node id</span> in the ASCII map, or type an id and press Goto.<br /><br />' +
        "Layers (L→R): " + esc(cols.map(function (c) { return c.title; }).join(" → ")) + ".<br /><br />" +
        "Search dims non-matching sections. Select/copy freely.";
    }
    if ($footerApi) {
      $footerApi.textContent = "graph.json";
    }
  }

  async function loadAndDraw() {
    $status.textContent = "Loading graph.json…";
    const res = await fetch("graph.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    graph = await res.json();
    updateChrome(graph);
    const built = buildAscii(graph);
    renderAscii(built.plain, $search.value);
    fillDatalist();
    $status.textContent =
      (graph.nodes || []).length + " nodes · " + (graph.edges || []).length + " edges · " +
      "updated " + ((graph.meta && graph.meta.updated) || "?") + " · ASCII regenerated";
    if (selectedId) showDetail(selectedId);
  }

  // Events
  if ($ascii) {
    $ascii.addEventListener("click", function (ev) {
      if (editMode) return;
      const t = ev.target.closest(".node-id");
      if (t && t.dataset.id) {
        showDetail(t.dataset.id);
        $goto.value = t.dataset.id;
      }
    });
  }

  if ($detail) {
    $detail.addEventListener("click", function (ev) {
      const t = ev.target.closest("[data-id]");
      if (t && t.dataset.id) {
        showDetail(t.dataset.id);
        $goto.value = t.dataset.id;
      }
    });
  }

  if ($search) {
    $search.addEventListener("input", function () {
      if (!asciiPlain || editMode) return;
      renderAscii(asciiPlain, $search.value);
    });
  }

  const btnGoto = document.getElementById("btn-goto");
  if (btnGoto) {
    btnGoto.addEventListener("click", function () {
      const id = $goto.value.trim();
      if (id) showDetail(id);
    });
  }
  if ($goto) {
    $goto.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        const id = $goto.value.trim();
        if (id) showDetail(id);
      }
    });
  }

  if ($fontsize && $ascii) {
    $fontsize.addEventListener("input", function () {
      $ascii.style.setProperty("--fs", $fontsize.value + "px");
    });
    $ascii.style.setProperty("--fs", $fontsize.value + "px");
  }

  const btnRegen = document.getElementById("btn-regen");
  if (btnRegen) {
    btnRegen.addEventListener("click", function () {
      loadAndDraw().catch(function (e) {
        $status.textContent = "Error: " + e.message;
      });
    });
  }

  const btnEdit = document.getElementById("btn-edit");
  if (btnEdit) {
    btnEdit.addEventListener("click", function (ev) {
      editMode = !editMode;
      ev.currentTarget.classList.toggle("active", editMode);
      ev.currentTarget.textContent = editMode ? "View" : "Edit";
      if (editMode) {
        $ascii.contentEditable = "true";
        $ascii.classList.add("edit-mode");
        $ascii.textContent = asciiPlain;
      } else {
        asciiPlain = $ascii.innerText.replace(/\u00a0/g, " ");
        $ascii.contentEditable = "false";
        $ascii.classList.remove("edit-mode");
        renderAscii(asciiPlain, $search.value);
      }
    });
  }

  const btnCopy = document.getElementById("btn-copy");
  if (btnCopy) {
    btnCopy.addEventListener("click", async function () {
      const text = editMode ? $ascii.innerText : asciiPlain;
      try {
        await navigator.clipboard.writeText(text);
        $status.textContent = "ASCII copied to clipboard (" + text.length + " chars)";
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        $status.textContent = "ASCII copied (" + text.length + " chars)";
      }
    });
  }

  if (asciiPlain && asciiPlain.indexOf("[") !== -1) {
    renderAscii(asciiPlain, "");
  }
  loadAndDraw().catch(function (e) {
    if ($detail) {
      $detail.innerHTML = '<p id="empty">Failed to load graph.json: ' + esc(e.message) +
        "<br/>Is the page served over HTTP with graph.json beside index.html?</p>";
    }
    if ($status) $status.textContent = "Error loading graph.json";
    if (asciiPlain) renderAscii(asciiPlain, $search ? $search.value : "");
  });
})();
