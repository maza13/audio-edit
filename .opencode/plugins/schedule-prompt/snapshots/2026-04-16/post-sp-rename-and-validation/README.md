# Schedule Prompt Plugin Documentation

## Overview

`schedule-prompt` is an OpenCode plugin that schedules prompts and re-injects them into the current session or an explicit target session. The plugin runs a single central controller, evaluates tasks on a 1-second tick, and uses `session.prompt` to deliver the scheduled prompt.

It supports:
- `once`
- `interval`
- `daily`
- current-session scheduling
- explicit target-session scheduling
- task inspection, update, cancellation, and bulk clear

## Default Timezone

All local-time scheduling uses **México Centro** by default: `America/Mexico_City`.

Per-task `timezone` is optional. If omitted, the plugin uses `America/Mexico_City`.

## Canonical Tools (`sp-*`)

### `sp-session-id`
Returns the current OpenCode session ID.

Legacy alias: `get-session-id`

### `sp-schedule`
Schedules a task into the current session.

Arguments:
- `prompt`
- `mode`: `once` | `interval` | `daily`
- `timezone?`
- `noReply?`
- `runAt?`
- `delaySeconds?`
- `everySeconds?`
- `time?`

Legacy alias: `schedule-prompt`

### `sp-schedule-to`
Schedules a task into an explicit target session ID.

Arguments:
- `sessionId`
- `prompt`
- `mode`: `once` | `interval` | `daily`
- `timezone?`
- `noReply?`
- `runAt?`
- `delaySeconds?`
- `everySeconds?`
- `time?`

Legacy alias: `schedule-prompt-to-session`

### `sp-list`
Lists all scheduled tasks with richer metadata:
- status
- mode and parameters
- next run
- timezone
- target session
- `noReply`
- `createdAt`
- `lastRunAt`

Legacy alias: `schedule-list`

### `sp-cancel`
Cancels one task by ID.

Legacy alias: `schedule-cancel`

### `sp-get`
Returns full details for one task by ID.

### `sp-update`
Updates an existing task without recreating it.

Supports updating:
- `prompt`
- `mode`
- `timezone`
- `noReply`
- `sessionId`
- `runAt`
- `delaySeconds`
- `everySeconds`
- `time`

### `sp-clear`
Clears tasks in bulk.

Arguments:
- `filter`: `all` (default), `pending`, `executed`, or `failed`

## Legacy Compatibility Tools

These remain available:
- `get-session-id`
- `schedule-prompt`
- `schedule-prompt-to-session`
- `schedule-list`
- `schedule-cancel`

## Task Model

```ts
{
  id: string
  motherSessionID: string
  motherAgent: string | null
  directory: string | null
  prompt: string
  timezone: string
  noReply: boolean

  type: "once" | "interval" | "daily"
  status: "pending" | "executed" | "failed"
  createdAt: string

  runAt?: string
  everySeconds?: number
  nextRunAt?: string
  time?: string

  lastRunAt?: string
  executedAt?: string
  failedAt?: string
  error?: string

  dailyLastTriggeredDate?: string | null
  dailyLastCompletedDate?: string | null
  dailyLastFailedDate?: string | null
}
```

## Notes

- The controller is centralized; there are no per-task timers.
- Multiline prompts are normalized before reinjection.
- `daily` is handled as a stable recurring rule with per-day activation state.
- Canonical tool names now use the `sp-*` prefix.
