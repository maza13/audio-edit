# Schedule Prompt

OpenCode plugin to schedule prompts into the current session or an explicit target session.

## What it does

- Schedules prompts with `once`, `interval`, or `daily`
- Re-injects the prompt into a session using `session.prompt`
- Uses one central controller (no per-task timers)
- Defaults to **México Centro** (`America/Mexico_City`)
- Supports multiline prompts as a single message

## How to use it

### Quick start

**Current session, once:**
```json
{ "prompt": "hola", "mode": "once", "delaySeconds": 20 }
```

**Other session, daily:**
```json
{ "sessionId": "ses_example123", "prompt": "hola", "mode": "daily", "time": "01:10" }
```

### Choose the right tool

- **Current session** → `sp-schedule`
- **Another session** → `sp-schedule-to`
- **See current session ID** → `sp-session-id`
- **List tasks** → `sp-list`
- **Get one task** → `sp-get`
- **Update one task** → `sp-update`
- **Cancel one task** → `sp-cancel`
- **Clear tasks in bulk** → `sp-clear`

### Choose the right mode

| Mode | Use when | Required fields |
|---|---|---|
| `once` | Run one time only | `runAt` or `delaySeconds` |
| `interval` | Repeat every N seconds | `everySeconds` |
| `daily` | Run every day at the same local time | `time` |

## Timezone rules

- Default timezone: **México Centro** (`America/Mexico_City`)
- If you do not pass `timezone`, the plugin assumes México Centro
- If you pass a `timezone`, it must be a valid IANA timezone
- For `daily`, always think in the chosen local timezone, not host time

## Canonical tools (`sp-*`)

### `sp-session-id`
Returns the current OpenCode session ID.

### `sp-schedule`
Schedules a prompt into the current session.

Arguments:
- `prompt`
- `mode` (`once`, `interval`, `daily`)
- `timezone?`
- `noReply?`
- `runAt?`
- `delaySeconds?`
- `everySeconds?`
- `time?`

Examples:

```json
{ "prompt": "hola", "mode": "once", "delaySeconds": 20 }
```

```json
{ "prompt": "hola", "mode": "daily", "time": "01:10" }
```

### `sp-schedule-to`
Schedules a prompt into an explicit target session ID.

Arguments:
- `sessionId`
- `prompt`
- `mode` (`once`, `interval`, `daily`)
- `timezone?`
- `noReply?`
- `runAt?`
- `delaySeconds?`
- `everySeconds?`
- `time?`

Example:

```json
{
  "sessionId": "ses_example123",
  "prompt": "hola, revisa esto",
  "mode": "once",
  "delaySeconds": 10
}
```

### `sp-list`
Lists all scheduled tasks with metadata.

Shows:
- status
- mode and parameters
- next run
- timezone
- target session
- `noReply`
- `createdAt`
- `lastRunAt`

### `sp-get`
Returns full details for one task by ID.

### `sp-update`
Updates an existing task without recreating it.

Can update:
- `prompt`
- `mode`
- `timezone`
- `noReply`
- `sessionId`
- `runAt`
- `delaySeconds`
- `everySeconds`
- `time`

### `sp-cancel`
Cancels one task by ID.

### `sp-clear`
Clears tasks in bulk.

`filter` values:
- `all` (default)
- `pending`
- `executed`
- `failed`

## Important behavior

- `once` is a one-shot task
- `interval` repeats every N seconds
- `daily` is a stable recurring rule, not a new task per day
- multiline prompts stay as one prompt body
- `noReply` defaults to `false`

## Task model

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

## Notes for agents

- Use `sp-schedule` for the current chat/session.
- Use `sp-schedule-to` when the prompt must go to a specific session ID.
- Leave `timezone` empty to use México Centro; set it only if you need a different zone.
- For daily tests, specify the exact `HH:mm` and remember the default timezone is México Centro.
