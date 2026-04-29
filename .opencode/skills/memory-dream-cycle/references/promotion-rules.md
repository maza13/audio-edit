# Memory Dream Cycle Promotion Rules

## Purpose

The dream cycle converts raw memory into durable operating knowledge. It does
not blindly rewrite project instructions; it proposes promotions first and only
writes reports/plans when explicitly applied.

## Memory Layers

1. **Raw capture**
   - `.learnings/LEARNINGS.md`
   - `.learnings/ERRORS.md`
   - `.learnings/FEATURE_REQUESTS.md`

2. **Structured graph**
   - `memory/ontology/graph.jsonl`
   - `memory/ontology/schema.yaml`

3. **Durable semantic memory**
   - Engram observations and session summaries.

4. **Operational prompt memory**
   - `AGENTS.md`, `TOOLS.md`, skill `SKILL.md` files, or project docs.

## Promotion Targets

| Target | Promote when |
|---|---|
| Engram | Learning should survive sessions but does not require file-level workflow changes. |
| Ontology | Knowledge has entities, relations, dependencies, or query value. |
| AGENTS.md | Rule changes how agents coordinate, delegate, verify, or report. |
| TOOLS.md | Rule documents tool/plugin/runtime gotchas. |
| Relevant SKILL.md | Rule changes when/how a skill should trigger or operate. |
| Project docs | Rule is a human-facing convention or architecture fact. |

## Promotion Thresholds

Promote when at least one is true:

- Same theme appears in 2+ memory entries.
- Priority is `high` or `critical`.
- The mistake is likely to recur across sessions.
- The learning affects multiple agents, skills, tools, or files.
- The user explicitly asks to remember, preserve, or systematize it.

## Consolidation Rules

- Distill incidents into short prevention rules.
- Prefer one general rule over many near-duplicate memories.
- Preserve links back to raw entries for traceability.
- Do not promote secrets, raw transcripts, credentials, or full command output.
- Mark unresolved risks separately from resolved rules.

## Apply Safety

Default mode is dry-run. Use `--apply` only after user approval.

Allowed writes with `--apply`:

- `memory/dreams/reports/dream-report-*.json`
- `memory/dreams/promotion-plan.md`

The dream script must not directly edit `AGENTS.md`, `TOOLS.md`, skill files, or
Engram. Those promotions require an explicit follow-up action by the primary
agent after reviewing the plan.
