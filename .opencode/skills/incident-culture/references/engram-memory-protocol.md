# Engram Memory Protocol for Incident Culture

This reference explains how the skill should use Engram memory before and after
an RCA.

## 1. Default scope selection

Use **project** scope by default.

Choose **project** when the incident is tied to:

- a repository
- a codebase-specific skill
- configuration, paths, tests, files, or branch behavior
- team conventions that only apply inside one project

Choose **personal/general** only when the lesson is portable across projects,
for example:

- a reusable operator habit
- a general multi-agent coordination anti-pattern
- a cross-project debugging lesson

If in doubt, save to **project**.

## 2. When to read memory first

Read memory before concluding the RCA when:

- the user asks "what happened before?"
- the user asks whether this already happened
- the incident looks recurrent
- the prevention step depends on historical pattern analysis

Recommended sequence:

1. Check recent memory context
2. Search by incident keywords if context is insufficient
3. Read the full observation if a likely match is found

## 3. What to save after the RCA

Save the completed incident immediately after analysis.

Suggested title pattern:

- `Fixed recursive glob incident in search skill`
- `Classified Windows temp-file shortcut as violation`
- `Captured null-input validation lesson in formatting skill`

Before saving, ask the skill to suggest a stable `topic_key`.

Suggested topic key pattern:

- `bug/<recurring-failure>`
- `decision/<architecture-choice>`
- `pattern/<systemic-behavior>`

Suggested content structure:

- **What**: What failed and what was analyzed
- **Why**: Why the RCA was triggered
- **Where**: Skill, repo, files, workflow, or system area involved
- **Learned**: Preventive lesson or pattern

## 4. Save one memory or two?

Use one memory entry when the lesson is only useful inside the project.

Save a second memory in personal/general scope only when there is a truly
portable lesson, such as:

- "Wildcard file search often needs recursive fallback"
- "Known-platform shortcuts are violations, not errors"

Do not duplicate memory unless the generalized lesson is clearly useful outside
the current project.

## 5. Recurring incident rule

If similar incidents appear repeatedly:

1. Link the new RCA to the previous pattern
2. Reuse the same topic key when the issue is evolving
3. Escalate from isolated incident to systemic pattern when recurrence is clear

## 6. Memory section in output

When memory is used, include:

```text
### Memory Actions
- Scope used: project | personal
- Related incidents found: <count>
- Memory saved: yes | no
```

This keeps the RCA auditable and makes memory behavior explicit.
