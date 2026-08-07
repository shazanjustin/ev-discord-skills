# ev-discord-skills

Skills for **ev**'s own coding-agent workspace that don't belong in the shared,
client-facing [`gravitas-skills`](https://github.com/shazanjustin/gravitas-skills)
repo — either because they're ops/debugging skills for the bot itself (container
access, session model, provider fallback behavior), or because they're kept
here deliberately rather than in the shared repo for some other reason.
`gravitas-skills` stays the one anyone building a Gravitas-facing agent should
pull from; this repo is ev-specific.

## Layout

Same convention as `gravitas-skills`: one directory per skill at repo root,
each containing a `SKILL.md` with YAML frontmatter (`name`, `description`,
optionally `compatibility`) followed by the runtime guide itself.

```
<skill-name>/
  SKILL.md
  (any supporting scripts/templates the skill needs)
```

Top-level directory names starting with `.` or `_` are ignored by the sync
in `gravitas-workspace.mjs` (see below) — that's deliberate, so a
placeholder/template can sit in the repo without being loaded as a real
skill. See `_example-skill/SKILL.md` for the minimal shape a new skill
should start from — copy that directory, rename it to drop the leading
`_`, and replace the contents.

## Cloning into a workspace

Cloned into `~/.ev-discord-skills` and merged into `<workspace>/.pi/skills`
alongside `gravitas-skills` — see `ensureSkillsMerged()` in
`gravitas-workspace.mjs` (`ev-discord` repo) for the merge logic and the
hard-reset-not-ff-pull sync each repo gets pulled with (rewritten upstream
history shouldn't wedge the sync). On a name collision between the two
repos, `gravitas-skills` wins.

## Skills

- **deadline-tracker** — adds a new row to the Gravitas Deadline Tracker
  Google Sheet via Composio's Google Sheets MCP tools, asking for missing
  context (owner, deadline, etc.) rather than guessing.

## Status

Wired into the live container as of 2026-08-07 — `gravitas-workspace.mjs`
in `ev-discord` clones this repo alongside `gravitas-skills` and merges
both into `.pi/skills` every boot.

Writing a new skill or editing existing skill logic here always needs an
explicit human go-ahead, same rule as `gravitas-skills` (see
`GRAVITAS_AGENTS.md` in `ev-discord`) — it's not something ev or a coding
agent should do unprompted just because a gap got noticed.
