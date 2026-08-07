# ev-discord-skills

Skills for **ev**'s own coding-agent workspace — the ops/debugging/self-maintenance
side of the [`ev-discord`](https://github.com/shazanjustin/ev-discord) bot, as
opposed to the client-facing marketing/reporting skills in the sibling repo
[`gravitas-skills`](https://github.com/shazanjustin/gravitas-skills).

Think: "help someone debug or extend the bot itself" (container access, session
model, provider fallback behavior, improvement backlog conventions) rather than
"pull Metricool data for a client report."

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

## Status

Scaffold only as of 2026-08-07 — no real skills written yet. Writing a new
skill or editing existing skill logic here always needs an explicit
human go-ahead, same rule as `gravitas-skills` (see `GRAVITAS_AGENTS.md` in
`ev-discord`), it's not something ev or a coding agent should do unprompted
just because a gap got noticed.
