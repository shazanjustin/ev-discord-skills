#!/usr/bin/env node

const SPREADSHEET_ID = "1OTM4bcQzouLn69H7nvIp_Yktr_nVGJDjxkH4JBlsipY";
const TAB_TITLE = "[ONLY FILL THIS UP]Deadline Tracker";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`;
const OWNERS = new Set(["Shazan", "Serene", "Dula", "Sky"]);
const STATUSES = new Set(["To start", "Can start", "Currently doing", "Ongoing", "Delivered"]);
const FIELD_TO_COL = {
  report: 1,
  frequency: 2,
  owner: 3,
  status: 4,
  waitingOn: 5,
  deadline: 6,
  qc: 7,
};

function usage(exitCode = 1) {
  console.error(`Usage:
  node edit_deadline_row.mjs (--row 30 | --match-report "Friso H1") [fields...] [--apply]

Fields:
  --report "New report name"
  --frequency Monthly
  --owner Shazan
  --status "Currently doing"
  --waiting-on "Client"
  --deadline "12 Aug 2026"
  --qc QC

Defaults to dry-run. Add --apply to write.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { apply: false, exact: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") { out.apply = true; continue; }
    if (arg === "--dry-run") { out.apply = false; continue; }
    if (arg === "--exact") { out.exact = true; continue; }
    if (!arg.startsWith("--")) usage();
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[++i];
    if (value === undefined) usage();
    out[key] = value;
  }
  return out;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function validate(args) {
  if (!args.row && !args.matchReport) throw new Error("Target required: pass --row or --match-report");
  if (args.row && args.matchReport) throw new Error("Use only one target: --row or --match-report");
  if (args.row && (!/^\d+$/.test(String(args.row)) || Number(args.row) < 2)) throw new Error("--row must be a sheet row number >= 2");

  const changed = Object.keys(FIELD_TO_COL).filter(k => args[k] !== undefined);
  if (!changed.length) throw new Error("No edit fields provided");

  for (const key of changed) args[key] = String(args[key]).trim();
  if (args.owner !== undefined && !OWNERS.has(args.owner)) throw new Error(`Invalid owner: ${args.owner}. Use one of: ${[...OWNERS].join(", ")}`);
  if (args.status !== undefined && !STATUSES.has(args.status)) throw new Error(`Invalid status: ${args.status}. Use one of: ${[...STATUSES].join(", ")}`);
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
  const envelope = JSON.parse(dataLine.slice(6));
  const text = envelope?.result?.content?.[0]?.text;
  if (!text) throw new Error(`Composio returned no tool text for ${name}`);
  const parsed = JSON.parse(text);
  if (parsed.successfull === false || parsed.successful === false || parsed.error) {
    throw new Error(`${name} failed: ${parsed.error || JSON.stringify(parsed).slice(0, 300)}`);
  }
  return parsed.data ?? parsed;
}

async function getDeadlineSheet() {
  const data = await mcpCall("GOOGLESHEETS_GET_SPREADSHEET_INFO", {
    spreadsheet_id: SPREADSHEET_ID,
    fields: "sheets.properties(sheetId,title,gridProperties)",
  });
  const exact = (data.sheets || []).find(s => s.properties?.title === TAB_TITLE);
  if (!exact) throw new Error(`Tab not found: ${TAB_TITLE}`);
  const props = exact.properties;
  return { sheetId: props.sheetId, title: props.title, rows: props.gridProperties?.rowCount || 1000 };
}

async function getRows(sheet, startRow, endRow) {
  const data = await mcpCall("GOOGLESHEETS_SPREADSHEETS_VALUES_BATCH_GET_BY_DATA_FILTER", {
    spreadsheetId: SPREADSHEET_ID,
    dataFilters: [{ gridRange: { sheetId: sheet.sheetId, startRowIndex: startRow - 1, endRowIndex: endRow, startColumnIndex: 0, endColumnIndex: 11 } }],
  });
  return data.valueRanges?.[0]?.valueRange?.values || [];
}

async function findTarget(sheet, args) {
  if (args.row) {
    const row = Number(args.row);
    const values = await getRows(sheet, row, row);
    return { row, values: normalizeRow(values[0] || []) };
  }

  const needle = String(args.matchReport).trim().toLowerCase();
  if (!needle) throw new Error("--match-report cannot be empty");
  const rows = await getRows(sheet, 2, sheet.rows);
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    const report = String(rows[i]?.[1] || "").trim();
    if (!report) continue;
    const hay = report.toLowerCase();
    if (args.exact ? hay === needle : hay.includes(needle)) {
      matches.push({ row: i + 2, report, values: normalizeRow(rows[i]) });
    }
  }
  if (!matches.length) throw new Error(`No row matched report: ${args.matchReport}`);
  if (matches.length > 1) {
    const candidates = matches.slice(0, 10).map(m => `row ${m.row}: ${m.report}`).join("; ");
    throw new Error(`Multiple rows matched. Re-run with --row or --exact. Candidates: ${candidates}`);
  }
  return matches[0];
}

function normalizeRow(row) {
  const out = Array.from({ length: 11 }, (_, i) => row?.[i] ?? "");
  return out;
}

function editedValues(existing, args, row) {
  const next = normalizeRow(existing);
  for (const [field, col] of Object.entries(FIELD_TO_COL)) {
    if (args[field] !== undefined) next[col] = args[field];
  }
  next[0] = "=ROW()-1";
  next[8] = `=IF(G${row}="","",G${row}-TODAY())`;
  next[9] = `=IF(G${row}="","",TEXT(G${row},"mmm yyyy"))`;
  next[10] = `=IF(OR(D${row}="",G${row}=""),"",D${row}&"|"&TEXT(G${row},"yyyymmdd"))`;
  return [next];
}

function changedFields(before, after) {
  const names = ["no", "report", "frequency", "owner", "status", "waitingOn", "deadline", "qc", "daysLeft", "month", "key"];
  return names.map((name, i) => ({ name, before: before[i] || "", after: after[0][i] || "" })).filter(x => x.before !== x.after && !["no", "daysLeft", "month", "key"].includes(x.name));
}

async function updateRow(sheet, row, values) {
  return mcpCall("GOOGLESHEETS_BATCH_UPDATE_VALUES_BY_DATA_FILTER", {
    spreadsheetId: SPREADSHEET_ID,
    valueInputOption: "USER_ENTERED",
    data: [{
      dataFilter: { gridRange: { sheetId: sheet.sheetId, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: 0, endColumnIndex: 11 } },
      majorDimension: "ROWS",
      values,
    }],
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  validate(args);
  const sheet = await getDeadlineSheet();
  const target = await findTarget(sheet, args);
  const values = editedValues(target.values, args, target.row);
  const changes = changedFields(target.values, values);
  if (!changes.length) throw new Error("Requested edit would not change anything");

  if (args.apply) await updateRow(sheet, target.row, values);

  console.log(JSON.stringify({
    ok: true,
    dryRun: !args.apply,
    spreadsheetId: SPREADSHEET_ID,
    sheetUrl: SHEET_URL,
    sheetTitle: sheet.title,
    sheetId: sheet.sheetId,
    row: target.row,
    matchedReport: target.report || target.values[1] || "",
    changes,
    values,
  }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
