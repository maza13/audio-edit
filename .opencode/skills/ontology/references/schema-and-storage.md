# Ontology Schema and Storage Reference

## CLI Location

The executable OpenCode implementation lives at:

```text
.opencode/skills/ontology/scripts/ontology.py
```

It uses only Python standard library modules and returns JSON for every command.
The default workspace root is the current directory. Use `--root` to target a
temporary test workspace or another project.

```bash
python .opencode/skills/ontology/scripts/ontology.py --root ./tmp init
python .opencode/skills/ontology/scripts/ontology.py --root ./tmp validate
```

Note: `schema.yaml` is written as JSON-compatible YAML for dependency-free
parsing. Keep custom schema patches JSON-compatible unless the CLI is later
extended with a YAML parser.

JSON arguments such as `--props`, `--where`, and `--data` accept either inline
JSON or `@path/to/file.json`. The `@file` form is recommended on shells where
quote escaping is fragile.

## Default Schema Skeleton

Use this as the starting point for `memory/ontology/schema.yaml`.

```yaml
types:
  Person:
    required: [name]
    forbidden_properties: [password, secret, token]

  Project:
    required: [name, status]
    status_enum: [proposed, active, paused, completed, archived]

  Task:
    required: [title, status]
    status_enum: [open, in_progress, blocked, done, cancelled]
    priority_enum: [low, medium, high, critical]

  Goal:
    required: [description]

  Event:
    required: [title, start]
    validate:
      - "end >= start if end exists"

  Document:
    required: [title]

  Note:
    required: [content]

  Action:
    required: [type, target, timestamp]

  Policy:
    required: [scope, rule, enforcement]

  Account:
    required: [service, username]
    forbidden_properties: [password, secret, token]

  Credential:
    required: [service, secret_ref]
    forbidden_properties: [password, secret, token]

relations:
  has_owner:
    from_types: [Project, Task]
    to_types: [Person]
    cardinality: many_to_one

  has_task:
    from_types: [Project, Event]
    to_types: [Task]
    cardinality: one_to_many

  for_project:
    from_types: [Task, Document, Event, Note, Action]
    to_types: [Project]
    cardinality: many_to_one

  depends_on:
    from_types: [Task, Document]
    to_types: [Task, Document]
    acyclic: true

  blocks:
    from_types: [Task]
    to_types: [Task]
    acyclic: true

  mentions:
    from_types: [Document, Message, Note]
    to_types: [Person, Project, Task, Goal, Event, Document, Note, Policy]

  derived_from:
    from_types: [Document, Note, Policy]
    to_types: [Document, Message, Note]
```

## Append-Only Operations

### Create Entity

```json
{"op":"create","entity":{"id":"task_write_specs","type":"Task","properties":{"title":"Write specs","status":"open","priority":"high"}},"timestamp":"2026-04-28T12:00:00Z"}
```

### Update Entity

```json
{"op":"update","id":"task_write_specs","properties":{"status":"in_progress"},"timestamp":"2026-04-28T12:10:00Z"}
```

### Relate Entities

```json
{"op":"relate","from":"proj_cca","rel":"has_task","to":"task_write_specs","timestamp":"2026-04-28T12:11:00Z"}
```

### Annotate Entity

```json
{"op":"annotate","id":"task_write_specs","note":"Blocked until proposal is approved","timestamp":"2026-04-28T12:12:00Z"}
```

### Deprecate Entity

```json
{"op":"deprecate","id":"task_old_plan","reason":"Superseded by task_write_specs","timestamp":"2026-04-28T12:13:00Z"}
```

## Query Patterns

- List by type: all entities where `type == Task`.
- Filter by property: `Task.status == open`.
- Follow relation: `Project --has_task--> Task`.
- Reverse relation: `Task <--has_task-- Project`.
- Dependency closure: recursively follow `depends_on` or `blocks`.

## Migration Threshold

Keep JSONL while:

- The graph is small enough to reconstruct quickly.
- Manual inspection remains useful.
- Writes are occasional and append-only.

Recommend SQLite when:

- Queries require joins over many relation types.
- The file grows too large for comfortable reads.
- Concurrent writers become likely.
- Validation needs indexed constraints.

Do not migrate storage without explicit user approval.
