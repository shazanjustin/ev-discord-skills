#!/usr/bin/env node

// Lists 7DAYS ads whose Start Date falls between today and the next working
// day, from the client's Digital Media Plan sheet. Read-only. Prints
// Discord-ready markdown on stdout, for a scheduled job to post verbatim.
//
// The window runs to the next weekday so a Friday run also covers Saturday,
// Sunday and Monday, and a weekday-only schedule never misses a weekend start.

const SPREADSHEET_ID = "1sQJ6ITjDiNPYd5Ar9LIyZjB-8rEwXiv_kNK10fPWxZs";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`;
const TZ = "Asia/Kuala_Lumpur";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY = 86400000;

// Columns in the DMP tabs: A tick, B platform, C title, D pillar, E objective,
// F format, G start, H end, ... N budget.
const COL = { tick: 0, platform: 1, title: 2, objective: 4, format: 5, start: 6, end: 7, budget: 13 };

function usage(exitCode = 1) {
  console.error(`Usage:
  node ads_start.mjs [--date 2026-10-02] [--days N] [--json]

--date  pretend today is this date (MYT), for testing
--days  fixed window length in days instead of "through the next weekday"
--json  print the matched rows as JSON instead of Discord text`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--json") { out.json = true; continue; }
    if (arg === "--help" || arg === "-h") usage(0);
    if (!arg.startsWith("--")) usage();
    const value = argv[++i];
    if (value === undefined) usage();
    out[arg.slice(2)] = value;
  }
  return out;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function mcpCall(name, args) {
  const res = await fetch(requireEnv("COMPOSIO_MCP_URL"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "x-api-key": requireEnv("COMPOSIO_API_KEY"),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const raw = await res.text();
  const dataLine = raw.split("\n").find(line => line.startsWith("data: "));
  if (!dataLine) throw new Error(`Composio returned no data line for ${name}: ${raw.slice(0, 300)}`);
  const text = JSON.parse(dataLine.slice(6))?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Composio returned no tool text for ${name}`);
  const parsed = JSON.parse(text);
  if (parsed.successfull === false || parsed.successful === false || parsed.error) {
    throw new Error(`${name} failed: ${parsed.error || JSON.stringify(parsed).slice(0, 300)}`);
  }
  return parsed.data ?? parsed;
}

// A calendar day in MYT as a UTC-midnight timestamp, so day arithmetic never
// depends on the container's UTC clock.
function mytToday() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());
  return Date.parse(`${parts}T00:00:00Z`);
}

function windowEnd(today, days) {
  if (days !== undefined) return today + (Number(days) - 1) * DAY;
  let end = today + DAY;
  while ([0, 6].includes(new Date(end).getUTCDay())) end += DAY;
  return end;
}

// Start dates are written "02 Oct" with no year, sometimes "02/10/2026".
// A yearless date takes its tab's year, except across the Dec/Jan seam: the
// "Jan CC" section of DMP '26 opens with "31 Dec", which is 2025.
function parseDate(value, tabYear, sectionMonth) {
  const s = String(value || "").trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?(?:\s+(\d{4}))?$/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  if (m[3]) return Date.UTC(+m[3], month, +m[1]);
  let year = tabYear;
  if (month === 11 && sectionMonth === 0) year -= 1;
  if (month === 0 && sectionMonth === 11) year += 1;
  return Date.UTC(year, month, +m[1]);
}

// End dates carry no year either; an end before its start crossed New Year.
function endDate(value, start) {
  const end = parseDate(value, new Date(start).getUTCFullYear(), null);
  if (end === null) return null;
  return end < start ? Date.UTC(new Date(end).getUTCFullYear() + 1, new Date(end).getUTCMonth(), new Date(end).getUTCDate()) : end;
}

function fmt(ts, opts) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...opts }).format(new Date(ts));
}

function money(value) {
  const n = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

async function readTab(tab) {
  const data = await mcpCall("GOOGLESHEETS_BATCH_GET", {
    spreadsheet_id: SPREADSHEET_ID,
    ranges: [`'${tab.replace(/'/g, "''")}'!A1:N1000`],
  });
  return data.valueRanges?.[0]?.values || [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = args.date ? Date.parse(`${args.date}T00:00:00Z`) : mytToday();
  if (Number.isNaN(today)) throw new Error(`Bad --date: ${args.date}`);
  const end = windowEnd(today, args.days);

  // This year's tab, plus next year's once the window could reach into it.
  const year = new Date(today).getUTCFullYear();
  const tabs = [year];
  if (new Date(end).getUTCFullYear() > year || new Date(today).getUTCMonth() === 11) tabs.push(year + 1);

  const ads = new Map();
  for (const [i, tabYear] of tabs.entries()) {
    let rows;
    try {
      rows = await readTab(`DMP '${String(tabYear).slice(2)}`);
    } catch (err) {
      if (i === 0) throw err;
      continue; // next year's tab not created yet
    }
    let sectionMonth = null;
    for (const row of rows) {
      // Section headers ("Oct CC", "Super Fantastik Campaign") have no title.
      const title = String(row[COL.title] || "").trim();
      if (!title) {
        if (row[1]) {
          const idx = MONTHS.indexOf(String(row[1]).trim().slice(0, 3).toLowerCase());
          sectionMonth = idx >= 0 ? idx : null;
        }
        continue;
      }
      if (!row[COL.platform]) continue;
      const start = parseDate(row[COL.start], tabYear, sectionMonth); // "N/A" -> null
      if (start === null || start < today || start > end) continue;
      const key = `${start}|${title.toLowerCase()}`;
      const ad = ads.get(key) || {
        title, start,
        end: endDate(row[COL.end], start),
        objective: String(row[COL.objective] || "").trim(),
        format: String(row[COL.format] || "").trim(),
        platforms: [], budget: 0, ticked: 0, rows: 0,
      };
      ad.platforms.push(String(row[COL.platform]).trim());
      ad.budget += money(row[COL.budget]);
      ad.rows += 1;
      if (String(row[COL.tick]).toUpperCase() === "TRUE") ad.ticked += 1;
      ads.set(key, ad);
    }
  }

  const list = [...ads.values()].sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  if (args.json) { console.log(JSON.stringify({ today, end, ads: list }, null, 2)); return; }

  const range = end === today
    ? fmt(today, { weekday: "short", day: "numeric", month: "short" })
    : `${fmt(today, { weekday: "short", day: "numeric", month: "short" })} – ${fmt(end, { weekday: "short", day: "numeric", month: "short" })}`;

  if (!list.length) {
    console.log(`No 7DAYS ads start ${range}.`);
    return;
  }

  const out = [`**7DAYS ads starting · ${range}**`];
  let lastDay = null;
  for (const ad of list) {
    if (ad.start !== lastDay) {
      const label = ad.start === today ? "Today" : ad.start === today + DAY ? "Tomorrow"
        : fmt(ad.start, { weekday: "long" });
      out.push("", `__${label}, ${fmt(ad.start, { day: "numeric", month: "short" })}__`);
      lastDay = ad.start;
    }
    const flight = ad.end && ad.end !== ad.start
      ? `${fmt(ad.start, { day: "numeric", month: "short" })} – ${fmt(ad.end, { day: "numeric", month: "short" })}`
      : fmt(ad.start, { day: "numeric", month: "short" });
    const details = [flight, ad.objective, ad.format, ad.budget ? `RM${ad.budget.toLocaleString("en-MY")}` : ""]
      .filter(Boolean).join(" · ");
    const tick = ad.ticked === ad.rows ? "ticked" : ad.ticked ? `${ad.ticked}/${ad.rows} ticked` : "not ticked";
    out.push(`**${ad.title.replace(/:$/, "")}** — ${ad.platforms.join(" · ")}`, `${details} · ${tick}`);
  }
  out.push("", SHEET_URL);
  console.log(out.join("\n"));
}

main().catch(err => {
  console.log(`Ads start reminder failed: ${err.message}`);
  process.exit(1);
});
