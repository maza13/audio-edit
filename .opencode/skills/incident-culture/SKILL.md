---
name: incident-culture
description: >
  Root Cause Analysis (RCA) skill for multi-agent environments, inspired by
  aviation's "Just Culture" framework. Use this skill whenever the user needs to
  understand what failed, why it failed, and how to prevent recurrence. Triggers
  on: error analysis, post-mortem requests, incident review, failure debugging,
  lessons-learned generation, repeated user corrections on the same drift,
  or when the user wants to recover or save project memory related to incidents.
  Integrates with Engram memory using project scope by default and
  personal/general scope only when the incident is cross-project or not tied to
  a repository. Supports early in-session RCA to freeze drift before it grows.
  NOT for live system recovery — use emergency protocols instead.
license: Apache-2.0
metadata:
  author: CCA-Team
  version: "1.0"
---

# Incident Culture

Root Cause Analysis for multi-agent systems, inspired by aviation's Just Culture
philosophy. Distinguishes honest errors from violations and negligence to
promote learning without blame.

## When to Use

- **Debug post-failure**: "The search skill failed — it didn't find a file that exists"
- **Post-mortem review**: "/incident [description]" or "genera lesson learned de [sesión]"
- **Pattern detection**: After 3+ similar incidents, analyze systemic risk
- **In-session drift control**: After 2 repeated user corrections on the same point, pause and run a brief RCA before continuing
- **Session debrief**: Close-of-session risk identification and recommendations
- **Memory recall**: "what failed before?", "have we seen this incident?", "record this lesson"
- **NOT for live recovery**: Use emergency protocols for active system failures

## Core Workflow

### Phase 1 — Capture the Incident

1. Accept user description or retrieve failure context
2. Identify: what failed, when, and which skill/agent was involved
3. Capture the exact error message or symptom observed
4. Record timeline: invocation → tool call → failure point → recovery
5. Determine memory scope before analysis:
   - Use **project** scope by default when the incident belongs to the current repo, workflow, or codebase
   - Use **personal/general** scope only when the lesson is reusable across projects or the user explicitly asks for general memory
   - If the user asks to recall previous similar incidents, query memory before concluding the RCA

### Phase 1.25 — Detect correction threshold

Before continuing, decide whether this is a **post-failure RCA** or an **in-session RCA**.

- **Post-failure RCA**: the failure already happened and the user wants analysis
- **In-session RCA**: the same drift has been corrected 2 or more times in the same conversation

If it is an **in-session RCA**, immediately freeze lateral exploration and emit this block before deeper analysis:

```text
### In-Session Trigger
- Correction threshold reached: yes
- Objective corrected: <one-sentence restatement>
- What NOT to do now: <shell / delegation / extra exploration / etc.>
- Next exact action: <single direct action>
```

This trigger is mandatory when the user says things like:
- "ese no es el punto"
- "no uses shell"
- "solo haz X"
- "llama la tool tú mismo"

### Phase 1.5 — Engram Memory Protocol

Use Engram as part of the workflow, not as an optional add-on.

1. **Recall first when relevant**
   - If the user asks what happened before, what was learned, or whether this already occurred, check recent memory context first
   - If recent context is not enough, search memory with keywords from the incident
   - If a match is found, pull the full observation before finalizing classification or prevention advice
2. **Select scope deliberately**
   - **project**: default for repository-specific failures, configs, paths, tests, or skills tied to one codebase
   - **personal/general**: only for portable lessons, cross-project patterns, or operator habits
3. **Save after analysis**
   - Save the incident as memory immediately after the RCA is completed
   - Save project-specific incidents to project scope
   - Save portable lessons to personal/general scope if the insight is clearly reusable across projects
4. **Use structured memory content**
   - Title should be short and searchable
   - Content must include: What, Why, Where, Learned
   - Reuse a stable topic when the same recurring incident evolves over time
   - Before saving, suggest a `topic_key` automatically from the incident title or summary, then reuse that key for future updates to the same pattern
   - Prefer topic keys shaped like `bug/<problem>`, `decision/<tradeoff>`, or `pattern/<recurring-behavior>`
   - If the memory system can infer a better key, accept that suggestion and keep it stable across repeats

### Phase 2 — Classify (Just Culture Framework)

Assign one classification per incident:

| Type | Meaning | Example |
|------|---------|---------|
| **Error** | Honest mistake, workflow gap | "Didn't know globRecursive was needed" |
| **Violation** | Deviated from known practice | "Used temp file despite knowing it fails on Windows" |
| **Negligence** | Reckless disregard for process | "Ignored all validation checks" |

Assign severity:

- **Critical**: Data loss, security breach, cascade failure
- **Media**: Degraded capability, recoverable with delay
- **Baja**: Cosmetic, work-around exists, no user impact

### Phase 3 — Root Cause Analysis

Answer the 5-question chain:

1. **What happened?** — Concrete description of the failure
2. **What was the expected behavior?** — What should have occurred
3. **What caused the failure?** — Immediate trigger (code, config, assumption)
4. **Why was the cause not caught earlier?** — Gap in validation or test
5. **How to prevent recurrence?** — Concrete, actionable change

Also classify the failure by **layer** when relevant:

1. **Tool / plugin / session actual**
2. **Runtime / UI / TUI**
3. **Shell / API externa**

Do not mix layers in the root cause. If multiple layers are involved, separate them explicitly.

### Phase 4 — Generate Output

Deliver hybrid RCA report:

```
## INCIDENT #{id}

### What Happened
[brief description]

### Timeline
- HH:MM - Skill X invoked
- HH:MM - Tool Y called
- HH:MM.s - Failure detected (symptom)
- HH:MM - Recovery initiated

### Root Cause
[cause chain, 1-3 sentences]

### Classification
- Type: Error | Violación | Negligencia
- Severity: Critical | Media | Baja
- Scope: Local | Sistema | Ecosistema

### Layer
- Primary layer: Tool/plugin/session | Runtime/UI/TUI | Shell/API externa
- Secondary layer: <optional>

### Prevention
[what changes to make — specific and actionable]

### Action Tracking
- Immediate containment: <single action to stop recurrence in this session>
- Structural fix: <skill / protocol / code / doc change>
- Validation needed: <observable proof required>

### Lessons Learned
[generalizable insight others can benefit from]

### Dashboard Metrics
- Incidentes este mes: {count}
- Tiempo promedio de RCA: {avg_min} min
- Incidentes recurrentes: {recurring_count} (mismo tipo)

### Memory Actions
- Scope used: project | personal
- Related incidents found: {count}
- Memory saved: yes | no
- Suggested topic_key: {topic_key}
```

### Phase 5 — Validate and Store

1. Confirm the RCA is coherent — no circular reasoning
2. Verify the selected memory scope is correct:
   - project when tied to the current repository/workflow
   - personal/general only for portable lessons
3. Store incident in Engram persistent memory for pattern analysis
4. If this is the 3rd+ incident of the same type, flag as systemic pattern
5. When saving, suggest a stable `topic_key` first and reuse it for future updates to the same incident family

## Critical Patterns

- **Default method**: Run the full 5-question chain; fallback to 3-question lite if user says "quick"
- **Blame-free**: Never attribute failure to "stupidity" or "carelessness" — focus on system gaps
- **Early stop-rule**: after 2 repeated corrections on the same drift, switch to in-session RCA and freeze new exploration
- **Pattern linkage**: After RCA, check memory for similar past incidents
- **Cross-reference**: If a skill fails, check if that skill has known failure modes documented
- **Memory scope default**: Prefer project memory unless the lesson is clearly cross-project
- **Memory discipline**: If a reusable lesson emerges, save the incident and the generalized lesson separately when needed
- **Topic key discipline**: Always propose a stable `topic_key` before saving so recurring incidents update the same memory thread
- **Observable success rule**: prevention is incomplete if it does not define how the user will verify success
- **Layer separation**: distinguish runtime/UI issues from tool/plugin/session issues before recommending fixes

## Output Contract

ALWAYS return the structured incident report format above. Always end with:

```
## Next Step
[single most important action to prevent recurrence]
```

If memory was consulted or saved, include a short `### Memory Actions` section.
If a memory entry was saved, include the suggested `topic_key` in that section.

If this was an in-session RCA, include a `### In-Session Trigger` section before `## Next Step`.

## Examples

**Example 1 — Search skill failure**

Input:
```
"The search skill failed - it didn't find config.json when using "config*.json""
```

Output:
```
## INCIDENT #004

### What Happened
Search skill returned empty results for "config*.json" when the file exists in a subdirectory.

### Timeline
- 10:32 - Search skill invoked with pattern "config*.json"
- 10:32.1 - glob tool executed (non-recursive)
- 10:32.1 - Empty result returned
- 10:33 - User reported failure

### Root Cause
The glob pattern was executed without the recursive flag, so subdirectories were not searched. The skill assumed flat directory structure.

### Classification
- Type: Error
- Severity: Media
- Scope: Local (affects only search operations)

### Prevention
1. Update search skill to use globRecursive when pattern contains wildcards
2. Add validation: if no results and pattern has wildcards, retry with recursive flag
3. Document: search skill expects flat structure by default

### Lessons Learned
Glob patterns without recursive flag will silently miss files in subdirectories. Always verify assumptions about directory depth.

### Memory Actions
- Scope used: project
- Related incidents found: 1
- Memory saved: yes

## Next Step
Update cca-search skill to detect wildcard patterns and automatically use recursive search.
```

## Resources

- [references/just-culture-framework.md](references/just-culture-framework.md) — Full taxonomy of error types
- [references/rca-methodology.md](references/rca-methodology.md) — 5-question chain deeper dive
- [references/engram-memory-protocol.md](references/engram-memory-protocol.md) — How to recall and save incident memory correctly
