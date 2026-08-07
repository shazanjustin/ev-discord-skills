---
name: deadline-tracker
description: >
  Adds a new row to the Gravitas Deadline Tracker Google Sheet -- the team's
  shared report/task list -- via the Composio Google Sheets MCP tools. Load
  this when someone asks to add a report/task/deadline to "the tracker",
  "our task list", "the deadline sheet", etc. (e.g. "ev add the Friso August
  report to the tracker", "add a task for the CIMB QC review"). Does not
  read/summarize the tracker -- only appends new rows.
compatibility: |
  Requires COMPOSIO_MCP_URL, COMPOSIO_API_KEY (and ideally
  COMPOSIO_EXTERNAL_USER_ID baked into COMPOSIO_MCP_URL's user_id query
  param) already set in the environment -- these are provisioned at
  container boot, not something this skill sets up. Needs curl.
---

# Deadline Tracker

**This is a runtime guide.** Follow the phases below in order. Don't guess
at fields you weren't given -- ask, per Phase 1.

## The sheet

Spreadsheet ID `1OTM4bcQzouLn69H7nvIp_Yktr_nVGJDjxkH4JBlsipY`
(`https://docs.google.com/spreadsheets/d/1OTM4bcQzouLn69H7nvIp_Yktr_nVGJDjxkH4JBlsipY`).
The tab you write to is literally named
`[ONLY FILL THIS UP]Deadline Tracker` (brackets and all, no space after
`]`). Don't assume that's still the exact tab name -- verify with
`GOOGLESHEETS_GET_SHEET_NAMES` first (Phase 2); it's the one other tabs
(`Calendar View`, `Dashboard`, `Clash Check`) are derived from, so it's the
only one you ever write to.

Columns, left to right (row 1 is the header):

| Col | Header        | Who fills it              | Notes |
|-----|---------------|----------------------------|-------|
| A   | No.           | **formula, you generate**  | `=ROW()-1` |
| B   | Report        | you, from the request      | free text, e.g. "Friso PCR" |
| C   | Frequency     | you, ask if unclear        | free text -- seen values: `Campaign`, `Monthly`, `Monthly-<Month>`, `Quarterly`, `H1`, `One-Off` |
| D   | Owner         | you, ask if not given      | dropdown, one of `Shazan`, `Serene`, `Dula`, `Sky` -- not strictly enforced by the sheet but never invent a 5th name |
| E   | Status        | you, default `To start`    | dropdown: `To start`, `Can start`, `Currently doing`, `Ongoing`, `Delivered` |
| F   | Waiting On    | you, default `-`           | free text |
| G   | EXT Deadline  | you, **required, ask if missing** | a real date, e.g. `12 Aug 2026` |
| H   | QC?           | you, default `-`           | free text, `QC` if a QC pass applies, else `-` |
| I   | Days Left     | **formula, you generate**  | `=IF(G{row}="","",G{row}-TODAY())` |
| J   | Month         | **formula, you generate**  | `=IF(G{row}="","",TEXT(G{row},"mmm yyyy"))` |
| K   | Key (auto)    | **formula, you generate**  | `=IF(OR(D{row}="",G{row}=""),"",D{row}&"\|"&TEXT(G{row},"yyyymmdd"))` |

Columns A, I, J, K are computed per-row formulas, not values dragged down by
Sheets automatically -- there's no ARRAYFORMULA on the whole column, each
row has its own copy referencing its own row number. You must construct
these yourself with the target row substituted in; leaving them blank
breaks that row's numbering and its Days Left / Month / sort key.

## Phase 1 -- Gather the fields, ask if missing

**Required, always ask if not stated:** Report name (B), EXT Deadline (G).
A deadline-tracker row without a due date is meaningless -- never invent
one or leave it blank to "fill in later."

**Ask if ambiguous, don't guess:** Owner (D) -- must be a real person, and
you can't reliably infer it from who's chatting (they might be adding it on
someone else's behalf). Frequency (C) -- ask what kind of report/task it is
if it's not obvious from context (one-off vs. recurring monthly/quarterly).

**Default silently unless told otherwise:** Status → `To start`, Waiting On
→ `-`, QC? → `-`.

If someone gives you everything in one message ("ev add a Monthly Friso
report for Shazan, due 20 Aug 2026, to the tracker") don't ask redundant
questions -- only ask for what's actually missing or unclear.

## Phase 2 -- Confirm the tab, find the next empty row

Verify the tab name (sheets get renamed):

```bash
curl -s "$COMPOSIO_MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: $COMPOSIO_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"GOOGLESHEETS_GET_SHEET_NAMES","arguments":{"spreadsheet_id":"1OTM4bcQzouLn69H7nvIp_Yktr_nVGJDjxkH4JBlsipY"}}}'
```

Response is SSE (`event: message\ndata: {...}`) -- parse the JSON after
`data: `, then the tool's own result is *itself* a JSON string inside
`result.content[0].text` (double-encoded). Both `Accept` header values and
`x-api-key` are required or the call fails (`-32000` / `401`).

Then find the real last-used row -- column A is pre-filled with the `=ROW()-1`
formula for hundreds of rows regardless of whether there's real data, so
**use column B (Report), not column A**, to find where data actually ends:

```json
{"name":"GOOGLESHEETS_VALUES_GET","arguments":{
  "spreadsheet_id":"1OTM4bcQzouLn69H7nvIp_Yktr_nVGJDjxkH4JBlsipY",
  "range":"'[ONLY FILL THIS UP]Deadline Tracker'!B2:B1000"
}}
```

Target row = (1-based index of the first empty cell in that range) + 1
(since the range starts at row 2). Re-check this right before writing each
time -- don't reuse a row number computed earlier in a longer conversation,
in case someone else edited the sheet meanwhile.

## Phase 3 -- Write the row

One `GOOGLESHEETS_VALUES_UPDATE` call, **not** `..._VALUES_APPEND` -- the
append tool's own schema warns it can land in the wrong columns via table
auto-detection; `VALUES_UPDATE` with an exact `A{row}:K{row}` range doesn't
have that risk. `value_input_option` **must** be `USER_ENTERED`, not `RAW`
-- `RAW` stores your formula strings as literal text instead of live
formulas, and stores the date as a plain string Sheets won't sort/compute
against.

```json
{"name":"GOOGLESHEETS_VALUES_UPDATE","arguments":{
  "spreadsheet_id":"1OTM4bcQzouLn69H7nvIp_Yktr_nVGJDjxkH4JBlsipY",
  "range":"'[ONLY FILL THIS UP]Deadline Tracker'!A{row}:K{row}",
  "value_input_option":"USER_ENTERED",
  "values":[[
    "=ROW()-1",
    "<Report>",
    "<Frequency>",
    "<Owner>",
    "<Status>",
    "<Waiting On>",
    "<EXT Deadline, e.g. 12 Aug 2026>",
    "<QC?>",
    "=IF(G{row}=\"\",\"\",G{row}-TODAY())",
    "=IF(G{row}=\"\",\"\",TEXT(G{row},\"mmm yyyy\"))",
    "=IF(OR(D{row}=\"\",G{row}=\"\"),\"\",D{row}&\"|\"&TEXT(G{row},\"yyyymmdd\"))"
  ]]
}}
```

Replace every `{row}` with the actual target row number (same one in
`range`).

## Phase 4 -- Confirm back

Reply in Discord with what got added (Report, Owner, Deadline at minimum)
and the sheet link. If the write call errors, say so plainly -- per the
house voice rules, don't paper over it with a generic "Done."
