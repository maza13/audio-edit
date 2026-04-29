# Session Wake Scheduler � Plugin Documentation

## Overview

`session-wake-scheduler` is an OpenCode plugin that schedules prompts and re-injects them into the originating (mother) OpenCode session. The plugin runs as a single central controller, evaluates all tasks on a 1-second tick, and uses `session.prompt` to deliver the scheduled prompt back to the original session.

## Timezone

All local-time scheduling uses **México Centro** by default: `America/Mexico_City`.

- `once` supports either an absolute ISO timestamp or a local date-time interpreted in the configured timezone.
- `daily` uses `HH:mm` in the configured timezone.
- `timezone` can be provided per task; otherwise the default is **México Centro** (`America/Mexico_City`).

## Core Concepts

### Mother Session Model

Every scheduled task captures the `sessionID` and `agent` name from the `ToolContext` at the moment it is scheduled. When the task fires, the plugin re-injects the prompt into that same session using `runtimeClient.session.prompt({ path: { id: motherSessionID }, ... })`. The session is the same session that scheduled the task � not a new session.

### Task Lifecycle

```
pending ? executed   (once task fires successfully)
pending ? failed     (once task throws on sendToMotherSession)
pending ? pending    (interval / daily � reset after each execution)
```

### Scheduling Modes

| Mode | Parameters | Description |
|------|-----------|-------------|
| `once` | `runAt` (ISO or local date-time) or `delaySeconds` | One-shot delivery at absolute time |
| `interval` | `everySeconds` | Repeats every N seconds |
| `daily` | `time` (HH:mm local) | Fires once per day at the given local time |

## Tools

### `schedule-prompt`

Schedules a new task.

**Arguments:**

| Argument | Type | Mode | Description |
|----------|------|------|-------------|
| `prompt` | string | all | The prompt text to re-inject |
| `mode` | string | optional | `"once"` (default), `"interval"`, or `"daily"` |
| `timezone` | string | optional | IANA timezone for local-time scheduling (default `México Centro` / `America/Mexico_City`) |
| `runAt` | string | once | ISO 8601 date string or local date-time for absolute time |
| `delaySeconds` | number | once | Delay from now in seconds (alternative to `runAt`) |
| `everySeconds` | number | interval | Seconds between executions |
| `time` | string | daily | Time in `HH:mm` local timezone |

**Example � once with delay:**
```json
{
  "prompt": "678 x 246",
  "mode": "once",
  "delaySeconds": 60
}
```

**Example � once at local time in Mexico City:**
```json
{
  "prompt": "prueba de hora puntual",
  "mode": "once",
  "runAt": "2026-04-15T23:19:00",
  "timezone": "America/Mexico_City"
}
```

**Example � interval every 5 minutes:**
```json
{
  "prompt": "Check system status",
  "mode": "interval",
  "everySeconds": 300
}
```

**Example � daily at 09:00:**
```json
{
  "prompt": "Morning standup reminder",
  "mode": "daily",
  "time": "09:00"
}
```

---

### `schedule-list`

Lists all scheduled tasks with their current status and next run time.

**Arguments:** none

**Output:** Human-readable table of all tasks, including:
- Task ID
- Status (`pending`, `executed`, `failed`)
- Scheduling mode and parameters
- Next run time (ISO) or `�` if not applicable
- First 80 characters of the prompt

---

### `schedule-cancel`

Cancels and removes a scheduled task by ID.

**Arguments:**

| Argument | Type | Description |
|----------|------|-------------|
| `taskId` | string | The task ID returned by `schedule-prompt` |

Already-executed or failed tasks are silently removed. Returns the cancelled task ID or `"Not found"` if the ID does not exist.

---

## Task Data Model

```typescript
{
  id: string
  motherSessionID: string
  motherAgent: string
  directory: string
  prompt: string
  timezone: string

  type: "once" | "interval" | "daily"
  status: "pending" | "executed" | "failed"

  createdAt: string

  // once
  runAt?: string

  // interval
  everySeconds?: number
  nextRunAt?: string

  // daily
  time?: string

  // result
  lastRunAt?: string
  executedAt?: string
  failedAt?: string
  error?: string
}
```

## Persistence

Tasks are stored in `schedule.json` at the plugin root. The store uses version `2.0.0`.

On every startup the plugin:
1. Loads and normalizes the store (ensures all tasks have `status`, `createdAt`, `timezone`)
2. Migrates older store versions to `2.0.0`
3. Starts the central controller

Pending `interval` and `daily` tasks that had no prior `lastRunAt` are recalculated from the startup time on the first controller tick.

## Validation (Phase 8)

All tasks are validated before being persisted:

| Rule | Mode | Error |
|------|------|-------|
| `runAt` must be a valid ISO date or local date-time | once | `once task runAt must be a valid ISO date` |
| `everySeconds` must be >= 1 | interval | `interval task requires everySeconds >= 1` |
| `time` must match `HH:mm` | daily | `daily task requires time in HH:mm format` |
| `motherSessionID` must be present | all | `task.motherSessionID is required` |
| `timezone` must be a valid IANA zone when provided | all | `task.timezone must be a valid IANA timezone` |

Invalid tasks throw before being added to the store.

## Controller Architecture

The plugin runs a single `setInterval` at 1000ms (1 second). Each tick:
1. Loads the store from disk
2. Iterates all `pending` tasks
3. Calls `msUntilNextRun` to check if due
4. Fires `sendToMotherSession` for due tasks
5. Updates task status to `executed` or `failed`
6. For `interval` and `daily` tasks, resets status back to `pending`

The controller is shared by all tasks � there are no per-task timers. This keeps resource usage flat regardless of how many tasks are scheduled.

## Restart Behavior

- `once` tasks that fired while the plugin was offline are **not** replayed (missed runs are not recovered)
- `interval` tasks recalculate from the last recorded `lastRunAt` if available, otherwise from `createdAt`
- `daily` tasks fire on the next occurrence after restart

## Implemented Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Unified data model | ? |
| 2 | Central controller (single loop) | ? |
| 3 | next-run calculation (once/interval/daily) | ? |
| 4 | Mother-session reinjection via session.prompt | ? |
| 5 | Expanded schedule-prompt tool | ? |
| 6 | Management tools: `schedule-list`, `schedule-cancel` | ? |
| 7 | Persistence / recovery polish + store normalization | ? |
| 8 | Lightweight validation for once/interval/daily | ? |
| 9 | Documentation | ? |

## Constraints Respected

- The central controller is retained and not replaced
- The mother-session reinjection model is preserved
- No per-task timers were added
- Only the two management tools (`schedule-list`, `schedule-cancel`) were added
- Store version normalized from `1.1.0` to `2.0.0` safely via `normalizeStore()`
