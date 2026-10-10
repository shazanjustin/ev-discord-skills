#!/usr/bin/env node
// Client for gravitas-radar (github.com/shazanjustin/gravitas-radar).
// Reads RADAR_URL and RADAR_TOKEN from the environment; never prints the token.
//
//   radar.mjs digest [--days 7] [--category agents] [--per-feed 12]
//   radar.mjs feeds
//   radar.mjs briefs [--limit 5]
//   radar.mjs save-brief --title "..." --file /tmp/brief.md [--kind weekly]
//
// save-brief takes the body from a file, not an argument: a brief is long
// markdown full of quotes and backticks, and shell-quoting it is how it gets
// silently truncated.

import { readFileSync } from "node:fs";

const URL_BASE = (process.env.RADAR_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.RADAR_TOKEN || "";

function fail(msg) {
  console.log(`Radar failed: ${msg}`);
  process.exit(1);
}

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    else out._.push(a);
  }
  return out;
}

async function call(path, init = {}) {
  if (!URL_BASE || !TOKEN) fail("RADAR_URL / RADAR_TOKEN are not set in this container. A human has to add them on the ev-discord Coolify app.");
  let res;
  try {
    res = await fetch(URL_BASE + path, {
      ...init,
      headers: { Authorization: `Bearer ${TOKEN}`, ...(init.headers || {}) },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    fail(e.name === "TimeoutError" ? "radar timed out" : `radar unreachable (${e.message})`);
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch {}
    fail(`HTTP ${res.status}: ${msg}`);
  }
  return text;
}

const a = args(process.argv.slice(2));
const cmd = a._[0];

if (cmd === "digest") {
  const q = new URLSearchParams({ days: String(a.days || 7), perFeed: String(a["per-feed"] || 12) });
  if (a.category) q.set("category", a.category);
  process.stdout.write(await call(`/digest?${q}`));
} else if (cmd === "feeds") {
  const { feeds } = JSON.parse(await call("/feeds"));
  for (const f of feeds) {
    const state = !f.enabled ? "paused" : f.lastStatus || "waiting";
    console.log(`${f.category.padEnd(10)} ${state.padEnd(12)} ${String(f.items7d).padStart(4)}/wk  ${f.name}  ${f.url}${f.lastStatus === "failed" && f.lastError ? `  (${f.lastError})` : ""}`);
  }
} else if (cmd === "briefs") {
  const { briefs } = JSON.parse(await call(`/briefs?limit=${Number(a.limit) || 5}`));
  if (!briefs.length) console.log("No briefs saved yet.");
  for (const b of briefs) console.log(`\n## #${b.id} ${b.title} (${b.created_at.slice(0, 10)}, ${b.kind})\n\n${b.body}`);
} else if (cmd === "save-brief") {
  if (!a.title || !a.file) fail("save-brief needs --title and --file");
  let body;
  try { body = readFileSync(a.file, "utf-8").trim(); } catch (e) { fail(`cannot read ${a.file}: ${e.message}`); }
  if (!body) fail(`${a.file} is empty`);
  const out = JSON.parse(await call("/briefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: String(a.title), body, kind: a.kind || "weekly", author: "ev" }),
  }));
  console.log(`Saved brief #${out.brief.id}: ${out.brief.title}`);
} else {
  console.log("usage: radar.mjs digest [--days N] [--category C] | feeds | briefs [--limit N] | save-brief --title T --file F");
  process.exit(cmd ? 1 : 0);
}
