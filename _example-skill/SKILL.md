---
name: example-skill
description: >
  Template only -- not a real skill. Copy this directory, rename it to match
  your skill's name, and replace this description with a specific one: what
  the skill does and, critically, when an agent should decide to load it.
compatibility: |
  Note any runtime requirements here (e.g. specific CLI tools, env vars that
  must already be set, network access needed). Delete this field if there
  are none.
---

# Example Skill

**This is a runtime guide.** When a real skill loads, an agent follows the
steps below directly — write it as instructions to *the agent*, not
documentation about the feature.

Delete this template content and replace it with the actual skill body.
Looking at `gravitas-gateway/SKILL.md` in `gravitas-skills` is a good
reference for how a real one turned out (execution-flow style, explicit
phases, doesn't assume state it hasn't verified).

## Suggested shape

1. State the goal in one line.
2. List preconditions/checks to run before doing anything (don't assume a
   credential, file, or running process exists — verify it).
3. Walk through the actual steps, in order.
4. Call out known failure modes and how to recognize them, if any are
   already known.
