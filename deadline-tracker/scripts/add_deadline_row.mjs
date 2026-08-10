#!/usr/bin/env node

const SPREADSHEET_ID = "1OTM4bcQzouLn69H7nvIp_Yktr_nVGJDjxkH4JBlsipY";
const TAB_TITLE = "[ONLY FILL THIS UP]Deadline Tracker";
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`;
const OWNERS = new Set(["Shazan", "Serene", "Dula", "Sky"]);
const STATUSES = new Set(["To start", "Can start", "Currently doing", "Ongoing", "Delivered"]);

function usage(exitCode = 1) {
  console.error(`Usage:
  node add_deadline_row.mjs --report "Friso" --frequency Monthly --owner Shazan --deadline "12 Aug 2026" [--status "To start"] [--waiting-on -] [--qc -] [--apply]

Defaults to dry-run. Add --apply to write.`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const out = { status: "To start", waitingOn: "-", qc: "-", apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") { out.apply = true; continue; }
    if (arg === "--dry-run") { out.apply = false; continue; }
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

function requireText(obj, key) {
  const value = String(obj[key] || "").trim();
  if (!value) throw new Error(`Missing --${key.replace(/[A-Z]/g, c => "-" + c.toLowerCase())}`);
  obj[key] = value;
}

function validate(args) {
  for (const key of ["report", "frequency", "owner", "deadline"]) requireText(args, key);
  for (const key of ["status", "waitingOn", "qc"]) args[key] = String(args[key] || "-").trim() || "-";
  if (!OWNERS.has(args.owner)) throw new Error(`Invalid owner: ${args.owner}. Use one of: ${[...OWNERS].join(", ")}`);
  if (!STATUSES.has(args.status)) throw new Error(`Invalid status: ${args.status}. Use one of: ${[...STATUSES].join(", ")}`);
}

async function mcpCall(name, args) {
  const url = requireEnv("COMPOSIO_MCP_URL");
  const key = requireEnv("COMPOSIO_API_KEY");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "x-api-key": key,
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
  const sheets = data.sheets || [];
  const exact = sheets.find(s => s.properties?.title === TAB_TITLE);
  if (!exact) throw new Error(`Tab not found: ${TAB_TITLE}`);
  const props = exact.properties;
  return { sheetId: props.sheetId, title: props.title, rows: props.gridProperties?.rowCount || 1000 };
}

async function findNextRow(sheet) {
  const data = await mcpCall("GOOGLESHEETS_SPREADSHEETS_VALUES_BATCH_GET_BY_DATA_FILTER", {
    spreadsheetId: SPREADSHEET_ID,
    dataFilters: [{ gridRange: { sheetId: sheet.sheetId, startRowIndex: 1, endRowIndex: sheet.rows, startColumnIndex: 1, endColumnIndex: 2 } }],
  });
  const values = data.valueRanges?.[0]?.valueRange?.values || [];
  let lastUsed = -1;
  for (let i = 0; i < values.length; i++) {
    if (String(values[i]?.[0] || "").trim()) lastUsed = i;
  }
  // Column B range starts at row 2. Use the row after the last non-empty
  // report, not the first gap: earlier failed attempts left a blank row before
  // later real tasks, and filling the hole makes the tracker look out of order.
  return lastUsed === -1 ? 2 : lastUsed + 3;
}

function rowValues(args, row) {
  return [[
    "=ROW()-1",
    args.report,
    args.frequency,
    args.owner,
    args.status,
    args.waitingOn,
    args.deadline,
    args.qc,
    `=IF(G${row}="","",G${row}-TODAY())`,
    `=IF(G${row}="","",TEXT(G${row},"mmm yyyy"))`,
    `=IF(OR(D${row}="",G${row}=""),"",D${row}&"|"&TEXT(G${row},"yyyymmdd"))`,
  ]];
}

async function updateRow(sheet, row, values) {
  // Use numeric gridRange, not A1 with the tab name. Composio rejects the real
  // tab title as a "placeholder value" because it starts with [ONLY FILL THIS UP].
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
  const row = await findNextRow(sheet);
  const values = rowValues(args, row);

  if (args.apply) await updateRow(sheet, row, values);

  console.log(JSON.stringify({
    ok: true,
    dryRun: !args.apply,
    spreadsheetId: SPREADSHEET_ID,
    sheetUrl: SHEET_URL,
    sheetTitle: sheet.title,
    sheetId: sheet.sheetId,
    row,
    report: args.report,
    owner: args.owner,
    deadline: args.deadline,
    values,
  }, null, 2));
}

main().catch(err => {
  console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
  process.exit(1);
});
