---
name: ads-start-reminder
description: Lists 7DAYS ads starting today through the next working day, read from the client's Digital Media Plan sheet (DMP tabs). Load this when someone asks which 7DAYS ads start today, tomorrow or this week, or for the daily ads-start reminder.
compatibility: |
  Requires COMPOSIO_MCP_URL and COMPOSIO_API_KEY already set in the container
  environment. Needs node 22+ with fetch. Read-only.
---

# 7DAYS ads start reminder

Run the bundled script and post its stdout as-is. It is read-only; it never
writes to the sheet.

```bash
node ~/.ev-discord-skills/ads-start-reminder/scripts/ads_start.mjs
```

By default the window is today through the next weekday, so a Friday run also
covers Saturday, Sunday and Monday. Options:

- `--days 7` — fixed window instead, e.g. "what starts this week"
- `--date 2026-10-02` — pretend today is that date (MYT)
- `--json` — matched rows as JSON, for follow-up questions

## The sheet

`https://docs.google.com/spreadsheets/d/1sQJ6ITjDiNPYd5Ar9LIyZjB-8rEwXiv_kNK10fPWxZs`

One tab per year, `DMP '26`, `DMP '27`. Each row is one ad on one platform.
The script groups rows by title and start date, so FB, IG and TT copies of one
ad show as one line.

Columns used: A tick box, B platform, C ad title, E objective, F format,
G start date, H end date, N budget.

Things that look wrong and are not:

- **Dates have no year** (`02 Oct`). The year comes from the tab. The Jan
  section opens with `31 Dec`, which belongs to the year before.
- **`N/A` start dates are skipped.** Those ads are not scheduled yet.
- **"not ticked"** reports column A as it is. Past ads that ran are mostly
  ticked. The script does not decide what an unticked box means.

If the script prints `Ads start reminder failed: ...`, post that line as-is.
Do not guess the ads from memory.
