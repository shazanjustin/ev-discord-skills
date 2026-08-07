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

See `example-skill/SKILL.md` for the minimal shape a new skill should start
from — copy that directory, rename it, and replace the contents.

## Cloning into a workspace

Mirrored the same way `gravitas-skills` gets pulled into `.pi/skills` — see
`gravitas-workspace.mjs` in `ev-discord` for the hard-reset-not-ff-pull sync
logic (rewritten upstream history shouldn't wedge the sync).

## Skills

- **deadline-tracker** — adds a new row to the Gravitas Deadline Tracker
  Google Sheet via Composio's Google Sheets MCP tools, asking for missing
  context (owner, deadline, etc.) rather than guessing.

## Status

As of 2026-08-07, **not yet wired into the live container** —
`gravitas-workspace.mjs` in `ev-discord` only clones `gravitas-skills` into
`.pi/skills` today. Making ev actually load skills from this repo at runtime
is a separate change to `ev-discord`'s own workspace-bootstrap code, not
something implied by writing skills here.

Writing a new skill or editing existing skill logic here always needs an
explicit human go-ahead, same rule as `gravitas-skills` (see
`GRAVITAS_AGENTS.md` in `ev-discord`) — it's not something ev or a coding
agent should do unprompted just because a gap got noticed.
