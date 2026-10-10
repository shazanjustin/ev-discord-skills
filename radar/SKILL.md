---
name: radar
description: Industry radar. Reads what subreddits, trade press, platform newsrooms and AI changelogs said this week, plus Shazan's saved links (ideas.shazan.me), from gravitas-radar. Load for the weekly radar brief, or when someone asks what's trending, what people are saying about a platform or tool, or what changed in the industry lately.
compatibility: |
  Requires RADAR_URL and RADAR_TOKEN in the container environment. Node 22+.
  Read-only except save-brief, which only writes to the radar's own briefs list.
---

# Radar

The feeds are collected by a separate service, gravitas-radar. You read them
through the bundled script. Which feeds exist is managed by people on
ev-status.shazan.me (Radar tab), not by you.

```bash
R=~/.ev-discord-skills/radar/scripts/radar.mjs
node $R digest                       # last 7 days, all categories, markdown
node $R digest --days 3 --category marketing
node $R feeds                        # which feeds exist and whether they work
node $R briefs --limit 2             # what earlier briefs already said
node $R save-brief --title "Radar: week of 12 Oct" --file /tmp/radar-brief.md
```

Categories: `agents` (AI tools, agent harnesses, models), `marketing`
(trade press, marketer subreddits), `platforms` (Meta, YouTube and other
official newsrooms), `internal` (Shazan's saved links from ideas.shazan.me).
People can add more, so check `feeds` instead of assuming this list.

For a quick question ("what's r/hermesagent talking about"), run `digest`
with the matching category, answer from it, and link the posts you cite.

## The weekly brief

When a scheduled job or a person asks for the weekly radar brief:

1. `node $R briefs --limit 2` so you don't repeat last week's picks.
2. `node $R digest --days 7`.
3. Write the brief to `/tmp/radar-brief.md` in the shape below.
4. `node $R save-brief --title "Radar: week of <Monday date>" --file /tmp/radar-brief.md`
5. Post the same brief as your reply.

Shape, Discord formatting, no tables:

**What's moving**: 3 to 5 things that more than one source is talking
about, or that a platform officially changed. One or two lines each: what
happened, why it matters to a social and performance agency, and the link.

**For clients**: 2 to 4 concrete angles. Name the client it fits (Friso
Gold, CIMB, NFC, Shiseido, Schwarzkopf, 7DAYS) only when the link between
the item and that client is real. A platform change that affects every
client is better said once than repeated for each one.

**For our stack**: 1 to 3 tools, techniques or model changes that could
make EV or the team's workflow better (from `agents`). Say what it would
replace or improve. Log each one to the AI improvement backlog with
`node /app/improvement-cli.mjs` (check `list --scope ai` first, `bump` instead of
duplicating). Logging is visibility only, not permission to build anything.

**From the ideas inbox**: saved links from `internal` that connect to
something above. Say what they connect to. Skip this section if nothing
connects; don't force it.

End with one line if the digest's "Feed health" section lists broken feeds,
so a thin week reads as "a source is down", not "nothing happened".

Rules:

- Every claim comes from an item in the digest, with its link. Do not add
  news from memory; this brief exists to be current, and your memory is not.
- A single Reddit post is one person's experience. Say "one user reports",
  not "people are finding". Several posts or an official source can carry
  a stronger statement.
- Calm and specific, no hype words. No em dashes or en dashes.
- Under 2,000 characters is not required; Discord splits long replies. But
  keep each item to two lines, and cut a weak item rather than padding.

If the script prints `Radar failed: ...`, post that line as-is and stop.
Do not write a brief from memory.
