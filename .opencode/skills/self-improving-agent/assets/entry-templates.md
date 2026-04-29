# Self-Improvement Entry Templates

## Learning Entry

```markdown
## [LRN-YYYYMMDD-XXX] category

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config | agent | workflow

### Summary
One-line description of what was learned.

### Details
What happened, what was wrong or incomplete, and what should be done instead.

### Suggested Action
Concrete prevention, documentation, implementation, or promotion step.

### Metadata
- Source: conversation | error | user_feedback | tool_result | review
- Related Files: path/to/file.ext
- Tags: tag1, tag2
- See Also: LRN-YYYYMMDD-XXX
- Pattern-Key: optional.stable.key
- Recurrence-Count: 1

---
```

## Error Entry

```markdown
## [ERR-YYYYMMDD-XXX] command_or_tool_name

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config | agent | workflow

### Summary
Brief description of what failed.

### Error
```text
Short sanitized excerpt of the error. Do not include secrets.
```

### Context
- Command/tool/operation attempted:
- Inputs or parameters:
- Environment details:
- Reproducible: yes | no | unknown

### Suggested Fix
What should be tried or changed next.

### Metadata
- Related Files: path/to/file.ext
- See Also: ERR-YYYYMMDD-XXX

---
```

## Feature Request Entry

```markdown
## [FEAT-YYYYMMDD-XXX] capability_name

**Logged**: ISO-8601 timestamp
**Priority**: low | medium | high | critical
**Status**: pending
**Area**: frontend | backend | infra | tests | docs | config | agent | workflow

### Requested Capability
What the user wanted to do.

### User Context
Why it matters and what problem it solves.

### Complexity Estimate
simple | medium | complex

### Suggested Implementation
How it could be built or which existing system it extends.

### Metadata
- Frequency: first_time | recurring
- Related Features: feature_or_skill_name

---
```

## Resolution Block

Append this when an entry is resolved or promoted:

```markdown
### Resolution
- **Resolved**: ISO-8601 timestamp
- **Status Change**: resolved | promoted | wont_fix
- **Evidence**: commit, PR, file path, command output summary, or user confirmation
- **Notes**: Brief explanation of what changed
```
