import { tool } from "@opencode-ai/plugin/tool"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const STORE = join(__dirname, "schedule.json")
const DEFAULT_TIMEZONE = "America/Mexico_City"
const DEFAULT_TIMEZONE_LABEL = "México Centro"

// ─────────────────────────────────────────────────────────────
// Phase 1 — Unified data model
// Task shape:
//   { id, motherSessionID, motherAgent, directory, prompt,
//     type: "once" | "interval" | "daily",
//     status: "pending" | "executed" | "failed",
//     createdAt,
//     timezone?,        // IANA timezone, default México Centro (America/Mexico_City)
//     noReply?,         // inject context without triggering AI response
//     // once
//     runAt?,           // ISO string or local date-time interpreted in timezone
//     // interval
//     everySeconds?,    // seconds between runs
//     // daily
//     time?,            // HH:mm local time
//     // result
//     lastRunAt?, executedAt?, failedAt?, error?
//   }
// ─────────────────────────────────────────────────────────────

let runtimeClient = null
let runtimeDirectory = null

// ─────────────────────────────────────────────────────────────
// Store helpers
// ─────────────────────────────────────────────────────────────

function loadStore() {
  if (!existsSync(STORE)) return { version: "2.0.0", tasks: [] }
  try {
    return JSON.parse(readFileSync(STORE, "utf-8"))
  } catch {
    return { version: "2.0.0", tasks: [] }
  }
}

function saveStore(store) {
  writeFileSync(STORE, JSON.stringify(store, null, 2), "utf-8")
}

function makeId() {
  return `sched-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}

function parseLocalDateTime(value) {
  const match = String(value)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s])(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: match[6] ? Number(match[6]) : 0,
  }
}

function getTimeZoneParts(date, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = Object.fromEntries(
    dtf.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function getLocalDateKey(date, timeZone) {
  const parts = getTimeZoneParts(date, timeZone)
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey).split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`
}

function dateKeyToUtc(dateKey, hh, mm, timeZone) {
  const [year, month, day] = String(dateKey).split("-").map(Number)
  return localDateTimeToUtc({ year, month, day, hour: hh, minute: mm, second: 0 }, timeZone)
}

function normalizeNoReply(value) {
  if (typeof value === "boolean") return value
  if (value == null) return false
  const normalized = String(value).trim().toLowerCase()
  if (["true", "1", "yes", "y", "si", "sí"].includes(normalized)) return true
  if (["false", "0", "no", "n"].includes(normalized)) return false
  throw new Error('noReply must be one of: true, false, 1, 0, yes, no')
}

function localDateTimeToUtc(parts, timeZone) {
  const targetAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second || 0)
  const zoneParts = getTimeZoneParts(new Date(targetAsUtc), timeZone)
  const observedAsUtc = Date.UTC(
    zoneParts.year,
    zoneParts.month - 1,
    zoneParts.day,
    zoneParts.hour,
    zoneParts.minute,
    zoneParts.second,
  )

  return new Date(targetAsUtc + (targetAsUtc - observedAsUtc))
}

function parseRunAtValue(runAt, timeZone) {
  if (!runAt) return null
  const text = String(runAt).trim()

  // Absolute ISO with timezone information
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(text)) {
    const date = new Date(text)
    return isNaN(date.getTime()) ? null : date
  }

  // Local date-time interpreted in the provided timezone
  const parts = parseLocalDateTime(text)
  if (!parts) return null
  return localDateTimeToUtc(parts, timeZone)
}

// ─────────────────────────────────────────────────────────────
// Phase 3 — next-run calculation
// ─────────────────────────────────────────────────────────────

/**
 * Returns the next absolute Date (UTC) when this task should fire.
 * Returns null if the task type is not understood.
 */
function getNextRun(task, now = new Date()) {
  const timeZone = task.timezone || DEFAULT_TIMEZONE
  switch (task.type) {
    case "once":
      // runAt may be absolute ISO or local date-time interpreted in timezone
      return task.runAt ? parseRunAtValue(task.runAt, timeZone) : null

    case "interval": {
      if (!task.everySeconds) return null
      if (task.nextRunAt) return new Date(task.nextRunAt)
      if (task.createdAt) return new Date(Date.parse(task.createdAt) + task.everySeconds * 1000)
      return new Date(now.getTime() + task.everySeconds * 1000)
    }

    case "daily": {
      if (!task.time) return null
      const [hh, mm] = task.time.split(":").map(Number)
      const todayKey = getLocalDateKey(now, timeZone)
      const targetDateKey = task.dailyLastTriggeredDate === todayKey ? addDaysToDateKey(todayKey, 1) : todayKey
      return dateKeyToUtc(targetDateKey, hh, mm, timeZone)
    }

    default:
      return null
  }
}

/**
 * Returns milliseconds until the next run, or -1 if not runnable.
 */
function msUntilNextRun(task, now = new Date()) {
  const next = getNextRun(task, now)
  if (!next) return -1
  return Math.max(0, next.getTime() - now.getTime())
}

// ─────────────────────────────────────────────────────────────
// Phase 2 — Central controller (single loop, no per-task timers)
// ─────────────────────────────────────────────────────────────

let controllerHandle = null
let isRunning = false

function startController() {
  if (controllerHandle) return
  controllerHandle = setInterval(controllerTick, 1000)
}

async function controllerTick() {
  if (isRunning) return
  isRunning = true

  try {
    const store = loadStore()
    const now = new Date()

    for (const task of store.tasks) {
      if (task.status !== "pending") continue
      if (!task.motherSessionID) continue

      const ms = msUntilNextRun(task, now)
      if (ms < 0) continue // not runnable
      if (ms > 0) continue // not due yet

      // Time to run
      try {
        await sendToMotherSession(task)
        markExecuted(task)
      } catch (err) {
        markFailed(task, err)
      }
    }
  } catch (err) {
    // Keep controller alive through transient errors
    console.error("[scheduler] tick error:", err)
  } finally {
    isRunning = false
  }
}

function stopController() {
  if (controllerHandle) {
    clearInterval(controllerHandle)
    controllerHandle = null
  }
}

// ─────────────────────────────────────────────────────────────
// Task status helpers
// ─────────────────────────────────────────────────────────────

function updateTask(taskId, updater) {
  const store = loadStore()
  store.tasks = store.tasks.map((t) => (t.id === taskId ? updater(t) : t))
  saveStore(store)
}

function markExecuted(task) {
  const now = new Date().toISOString()
  if (task.type === "once") {
    // one-shot: mark done
    updateTask(task.id, () => ({
      ...task,
      status: "executed",
      executedAt: now,
      lastRunAt: now,
    }))
  } else if (task.type === "interval") {
    // interval: reset to pending for next cycle
    const nextRunAt =
      new Date(Date.parse(now) + task.everySeconds * 1000).toISOString()
    updateTask(task.id, () => ({
      ...task,
      status: "pending",
      executedAt: now,
      lastRunAt: now,
      nextRunAt,
    }))
  } else {
    const timeZone = task.timezone || DEFAULT_TIMEZONE
    const todayKey = getLocalDateKey(new Date(now), timeZone)
    updateTask(task.id, () => ({
      ...task,
      status: "pending",
      executedAt: now,
      lastRunAt: now,
      dailyLastTriggeredDate: todayKey,
      dailyLastCompletedDate: todayKey,
    }))
  }
}

function markFailed(task, err) {
  const failedAt = new Date().toISOString()
  if (task.type === "daily") {
    const timeZone = task.timezone || DEFAULT_TIMEZONE
    const todayKey = getLocalDateKey(new Date(failedAt), timeZone)
    updateTask(task.id, () => ({
      ...task,
      status: "pending",
      error: String(err?.message ?? err),
      failedAt,
      dailyLastFailedDate: todayKey,
    }))
    return
  }

  updateTask(task.id, () => ({
    ...task,
    status: "failed",
    error: String(err?.message ?? err),
    failedAt,
  }))
}

// ─────────────────────────────────────────────────────────────
// Mother-session reinjection  — Phase 4
// ─────────────────────────────────────────────────────────────

async function sendToMotherSession(task) {
  if (!runtimeClient) throw new Error("Scheduler runtime client unavailable")
  if (!task.motherSessionID) throw new Error("Task is missing motherSessionID")

  const promptText = String(task.prompt ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  await runtimeClient.session.prompt({
    path: { id: task.motherSessionID },
    body: {
      noReply: Boolean(task.noReply),
      agent: task.motherAgent,
      parts: [{ type: "text", text: promptText }],
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Startup hydration — preserve original behaviour
// ─────────────────────────────────────────────────────────────

function hydrateController() {
  const store = loadStore()
  for (const task of store.tasks) {
    if (task.status === "pending") {
      // Ensure next-run is set for interval/daily tasks that were loaded fresh
      if (!task.lastRunAt && (task.type === "interval" || task.type === "daily")) {
        // Will be calculated on first tick from "now"
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Phase 6 — Management tools: schedule-list, schedule-cancel
// ─────────────────────────────────────────────────────────────

/**
 * Returns all tasks with computed next-run embedded.
 */
function listTasks() {
  const store = loadStore()
  const now = new Date()
  return store.tasks.map((task) => {
    const next = getNextRun(task, now)
    return {
      ...task,
      nextRunMs: next ? next.getTime() - now.getTime() : -1,
      nextRunISO: next ? next.toISOString() : null,
    }
  })
}

function getTask(taskId) {
  const store = loadStore()
  return store.tasks.find((t) => t.id === taskId) ?? null
}

function cancelTask(taskId) {
  const store = loadStore()
  const idx = store.tasks.findIndex((t) => t.id === taskId)
  if (idx === -1) return false
  const task = store.tasks[idx]

  // Prevent cancelling already terminal statuses
  if (task.status === "executed" || task.status === "failed") {
    // Still remove from store to keep list clean
    store.tasks.splice(idx, 1)
    saveStore(store)
    return true
  }

  store.tasks.splice(idx, 1)
  saveStore(store)
  return true
}

function clearTasks(filter = "all") {
  const store = loadStore()
  const originalCount = store.tasks.length
  if (filter === "all") {
    store.tasks = []
  } else {
    store.tasks = store.tasks.filter((t) => t.status !== filter)
  }
  saveStore(store)
  return { removed: originalCount - store.tasks.length, remaining: store.tasks.length }
}

// ─────────────────────────────────────────────────────────────
// Phase 7 — Persistence / Recovery
// Normalize store to current version, improve restart hydration
// ─────────────────────────────────────────────────────────────

function normalizeStore() {
  const store = loadStore()
  let changed = false

  // Migrate version
  if (store.version !== "2.0.0") {
    store.version = "2.0.0"
    changed = true
  }

  // Ensure every task has current recurring-state defaults
  for (const task of store.tasks) {
    if (!task.createdAt) {
      task.createdAt = new Date().toISOString()
      changed = true
    }
    if (task.type === "interval" && !task.nextRunAt && task.createdAt && task.everySeconds) {
      task.nextRunAt = new Date(Date.parse(task.createdAt) + task.everySeconds * 1000).toISOString()
      changed = true
    }
    if (!task.timezone) {
      task.timezone = DEFAULT_TIMEZONE
      changed = true
    }
    // Re-hydrate status if missing or stale
    if (!task.status || !["pending", "executed", "failed"].includes(task.status)) {
      task.status = "pending"
      changed = true
    }
    if (typeof task.noReply !== "boolean") {
      task.noReply = false
      changed = true
    }
    if (task.type === "daily") {
      if (task.status !== "pending") {
        task.status = "pending"
        changed = true
      }
      if (!("dailyLastTriggeredDate" in task)) {
        task.dailyLastTriggeredDate = null
        changed = true
      }
      if (!("dailyLastCompletedDate" in task)) {
        task.dailyLastCompletedDate = null
        changed = true
      }
      if (!("dailyLastFailedDate" in task)) {
        task.dailyLastFailedDate = null
        changed = true
      }
    }
  }

  if (changed) saveStore(store)
  return store
}

// Restart-safe hydration: called on every plugin startup
function hydrateOnRestart() {
  const store = normalizeStore()
  // interval tasks that were "pending" but have no lastRunAt
  // will be recalculated from now in getNextRun (phase 3 logic)
  // daily tasks similarly — no special handling needed
  return store
}

// ─────────────────────────────────────────────────────────────
// Phase 8 — Lightweight validation for once / interval / daily
// Documented inline; no formal test framework required.
// Validation is performed at schedule time and at tick time.
// ─────────────────────────────────────────────────────────────

/**
 * Validates a task before it is persisted.
 * Throws on invalid task shape.
 */
function validateTask(task) {
  if (!task.id || typeof task.id !== "string") throw new Error("task.id is required")
  if (!task.type || !["once", "interval", "daily"].includes(task.type))
    throw new Error("task.type must be one of: once, interval, daily")
  if (!task.motherSessionID) throw new Error("task.motherSessionID is required")
  if (!task.prompt || typeof task.prompt !== "string") throw new Error("task.prompt is required")
  if (!task.status || !["pending", "executed", "failed"].includes(task.status))
    throw new Error("task.status must be one of: pending, executed, failed")
  if (task.timezone && !isValidTimeZone(task.timezone)) throw new Error("task.timezone must be a valid IANA timezone")
  if ("noReply" in task && typeof task.noReply !== "boolean") throw new Error("task.noReply must be boolean")

  if (task.type === "once") {
    if (!task.runAt) throw new Error("once task requires runAt")
    const d = parseRunAtValue(task.runAt, task.timezone || DEFAULT_TIMEZONE)
    if (isNaN(d.getTime())) throw new Error("once task runAt must be a valid ISO date")
  }

  if (task.type === "interval") {
    if (!task.everySeconds || task.everySeconds < 1)
      throw new Error("interval task requires everySeconds >= 1")
    if (task.nextRunAt) {
      const d = new Date(task.nextRunAt)
      if (isNaN(d.getTime())) throw new Error("interval task nextRunAt must be a valid ISO date")
    }
  }

  if (task.type === "daily") {
    if (!task.time || !/^\d{2}:\d{2}$/.test(task.time))
      throw new Error("daily task requires time in HH:mm format")
    if (task.dailyLastTriggeredDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(task.dailyLastTriggeredDate))
      throw new Error("dailyLastTriggeredDate must be YYYY-MM-DD or null")
    if (task.dailyLastCompletedDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(task.dailyLastCompletedDate))
      throw new Error("dailyLastCompletedDate must be YYYY-MM-DD or null")
    if (task.dailyLastFailedDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(task.dailyLastFailedDate))
      throw new Error("dailyLastFailedDate must be YYYY-MM-DD or null")
  }

  return true
}

function persistTask(task) {
  validateTask(task) // throws on bad data
  const store = loadStore()
  store.tasks.push(task)
  saveStore(store)
}

function buildRawTask(args, mode) {
  if (mode === "once") return scheduleOnce(args)
  if (mode === "interval") return scheduleInterval(args)
  if (mode === "daily") return scheduleDaily(args)
  throw new Error(`Unknown mode: ${mode}. Use "once", "interval", or "daily"`)
}

function updateTaskDefinition(taskId, args) {
  const existing = getTask(taskId)
  if (!existing) throw new Error(`Task not found: ${taskId}`)

  const mode = args.mode ?? existing.type
  const mergedArgs = {
    prompt: args.prompt ?? existing.prompt,
    timezone: args.timezone ?? existing.timezone ?? DEFAULT_TIMEZONE,
    noReply: "noReply" in args ? normalizeNoReply(args.noReply) : Boolean(existing.noReply),
    runAt: args.runAt ?? existing.runAt,
    delaySeconds: args.delaySeconds,
    everySeconds: args.everySeconds ?? existing.everySeconds,
    time: args.time ?? existing.time,
  }

  const rebuilt = buildRawTask(mergedArgs, mode)
  const updated = {
    ...existing,
    ...rebuilt,
    id: existing.id,
    createdAt: existing.createdAt,
    motherSessionID: args.sessionId ?? existing.motherSessionID,
    motherAgent: args.agent ?? existing.motherAgent,
    directory: existing.directory,
    status: existing.type === "once" && mode === "once" ? existing.status : "pending",
  }

  if (mode === "daily") {
    updated.dailyLastTriggeredDate = null
    updated.dailyLastCompletedDate = null
    updated.dailyLastFailedDate = null
    delete updated.nextRunAt
    delete updated.runAt
    delete updated.everySeconds
  }
  if (mode === "interval") {
    delete updated.runAt
    delete updated.time
    delete updated.dailyLastTriggeredDate
    delete updated.dailyLastCompletedDate
    delete updated.dailyLastFailedDate
  }
  if (mode === "once") {
    delete updated.nextRunAt
    delete updated.time
    delete updated.everySeconds
    delete updated.dailyLastTriggeredDate
    delete updated.dailyLastCompletedDate
    delete updated.dailyLastFailedDate
  }

  validateTask(updated)
  updateTask(taskId, () => updated)
  return updated
}

// ─────────────────────────────────────────────────────────────
// Phase 5 — Expanded schedule-prompt
// Supports: once (runAt | delaySeconds), interval (everySeconds), daily (time HH:mm)
// ─────────────────────────────────────────────────────────────

function scheduleOnce(args) {
  const { prompt, runAt, delaySeconds } = args
  if (!runAt && !delaySeconds) {
    throw new Error("once mode requires runAt (ISO string) or delaySeconds (number)")
  }

  let runAtDate
  if (runAt) {
    runAtDate = new Date(runAt)
    if (isNaN(runAtDate.getTime())) throw new Error("runAt must be a valid ISO date string")
  } else {
    runAtDate = new Date(Date.now() + delaySeconds * 1000)
  }

  return {
    id: makeId(),
    type: "once",
    motherSessionID: null,   // filled in by execute
    motherAgent: null,
    directory: runtimeDirectory,
    prompt,
    timezone: args.timezone || DEFAULT_TIMEZONE,
    noReply: normalizeNoReply(args.noReply),
    runAt: runAtDate.toISOString(),
    status: "pending",
    createdAt: new Date().toISOString(),
  }
}

function scheduleInterval(args) {
  const { prompt, everySeconds } = args
  if (!everySeconds || everySeconds < 1) {
    throw new Error("interval mode requires everySeconds >= 1")
  }

  const createdAt = new Date().toISOString()
  return {
    id: makeId(),
    type: "interval",
    motherSessionID: null,
    motherAgent: null,
    directory: runtimeDirectory,
    prompt,
    everySeconds,
    timezone: args.timezone || DEFAULT_TIMEZONE,
    noReply: normalizeNoReply(args.noReply),
    nextRunAt: new Date(Date.parse(createdAt) + everySeconds * 1000).toISOString(),
    status: "pending",
    createdAt,
  }
}

function scheduleDaily(args) {
  const { prompt, time } = args
  if (!time || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("daily mode requires time in HH:mm format (e.g. 09:30)")
  }

  return {
    id: makeId(),
    type: "daily",
    motherSessionID: null,
    motherAgent: null,
    directory: runtimeDirectory,
    prompt,
    timezone: args.timezone || DEFAULT_TIMEZONE,
    noReply: normalizeNoReply(args.noReply),
    time,
    dailyLastTriggeredDate: null,
    dailyLastCompletedDate: null,
    dailyLastFailedDate: null,
    status: "pending",
    createdAt: new Date().toISOString(),
  }
}

function buildTask(raw, context) {
  const base = {
    motherSessionID: context.sessionID,
    motherAgent: context.agent,
    directory: context.directory ?? runtimeDirectory,
  }
  return { ...raw, ...base }
}

function buildTaskForSession(raw, context, sessionId) {
  const base = {
    motherSessionID: sessionId,
    motherAgent: context.agent,
    directory: context.directory ?? runtimeDirectory,
  }
  return { ...raw, ...base }
}

function schedulePrompt(args, context) {
  if (!context?.sessionID) {
    throw new Error("schedule-prompt requires sessionID in ToolContext")
  }

  const mode = args.mode ?? (args.type ?? "once")

  const rawTask = buildRawTask(args, mode)

  const task = buildTask(rawTask, context)
  if (!task.timezone) task.timezone = args.timezone || DEFAULT_TIMEZONE

  persistTask(task) // validates before saving

  return task
}

function schedulePromptToSession(args, context) {
  if (!context?.sessionID) {
    throw new Error("schedule-prompt-to-session requires caller sessionID in ToolContext")
  }
  if (!args.sessionId || typeof args.sessionId !== "string") {
    throw new Error("schedule-prompt-to-session requires sessionId")
  }

  const mode = args.mode ?? (args.type ?? "once")

  const rawTask = buildRawTask(args, mode)

  const task = buildTaskForSession(rawTask, context, args.sessionId)
  if (!task.timezone) task.timezone = args.timezone || DEFAULT_TIMEZONE

  persistTask(task)

  return task
}

function formatTaskSummary(task, extra = {}) {
  const next = getNextRun(task)
  const lines = [
    `Scheduled: ${task.id}`,
    `Mode: ${task.type}`,
    `Timezone: ${task.timezone || DEFAULT_TIMEZONE}`,
    `TargetSession: ${task.motherSessionID}`,
    `NoReply: ${Boolean(task.noReply)}`,
    `NextRun: ${next ? next.toISOString() : "N/A"}`,
    `Status: ${task.status}`,
  ]
  if (extra.callerSession) lines.splice(4, 0, `CallerSession: ${extra.callerSession}`)
  return lines.join("\n")
}

function formatTaskDetails(task) {
  const next = getNextRun(task)
  const lines = [
    `ID: ${task.id}`,
    `Status: ${task.status}`,
    `Type: ${task.type}`,
    `TargetSession: ${task.motherSessionID}`,
    `Agent: ${task.motherAgent ?? "—"}`,
    `Timezone: ${task.timezone || DEFAULT_TIMEZONE}`,
    `NoReply: ${Boolean(task.noReply)}`,
    `CreatedAt: ${task.createdAt ?? "—"}`,
    `NextRun: ${next ? next.toISOString() : "N/A"}`,
  ]
  if (task.runAt) lines.push(`RunAt: ${task.runAt}`)
  if (task.everySeconds) lines.push(`EverySeconds: ${task.everySeconds}`)
  if (task.time) lines.push(`Time: ${task.time}`)
  if (task.lastRunAt) lines.push(`LastRunAt: ${task.lastRunAt}`)
  if (task.executedAt) lines.push(`ExecutedAt: ${task.executedAt}`)
  if (task.failedAt) lines.push(`FailedAt: ${task.failedAt}`)
  if (task.dailyLastTriggeredDate != null) lines.push(`DailyLastTriggeredDate: ${task.dailyLastTriggeredDate}`)
  if (task.dailyLastCompletedDate != null) lines.push(`DailyLastCompletedDate: ${task.dailyLastCompletedDate}`)
  if (task.dailyLastFailedDate != null) lines.push(`DailyLastFailedDate: ${task.dailyLastFailedDate}`)
  lines.push(`Prompt: ${task.prompt}`)
  if (task.error) lines.push(`Error: ${task.error}`)
  return lines.join("\n")
}

function formatTaskList(tasks) {
  if (!tasks.length) return "No scheduled tasks."
  const lines = tasks.map((t) => {
    const next = t.nextRunISO ?? "—"
    const target = t.motherSessionID ?? "—"
    const modeParam = t.type === "once"
      ? `runAt=${t.runAt ?? "—"}`
      : t.type === "interval"
        ? `everySeconds=${t.everySeconds ?? "—"}`
        : `time=${t.time ?? "—"}`
    return (
      `[${t.status.padEnd(8)}] ${t.id}\n` +
      `  type=${t.type}  ${modeParam}\n` +
      `  next=${next}  timezone=${t.timezone || DEFAULT_TIMEZONE}\n` +
      `  target=${target}  noReply=${Boolean(t.noReply)}\n` +
      `  created=${t.createdAt}  lastRun=${t.lastRunAt ?? "—"}\n` +
      `  prompt: ${t.prompt.slice(0, 120)}${t.prompt.length > 120 ? "…" : ""}`
    )
  })
  return ["Total tasks: " + tasks.length, "", ...lines].join("\n")
}

function scheduleArgsSchema(includeSessionId = false) {
  const args = {
    prompt: tool.schema.string().describe("Prompt to send later"),
    mode: tool.schema.string().optional().describe('Scheduling mode: "once" (default), "interval", "daily"'),
    timezone: tool.schema.string().optional().describe(`IANA timezone for local times (default: ${DEFAULT_TIMEZONE_LABEL} / ${DEFAULT_TIMEZONE})`),
    noReply: tool.schema.string().optional().describe('Inject context without triggering AI response: true/false'),
    runAt: tool.schema.string().optional().describe("ISO date string or local date-time interpreted in timezone (once mode)"),
    delaySeconds: tool.schema.number().optional().describe("Delay in seconds (once mode, alternative to runAt)"),
    everySeconds: tool.schema.number().optional().describe("Seconds between executions (interval mode)"),
    time: tool.schema.string().optional().describe("HH:mm time in local timezone (daily mode)"),
  }
  if (includeSessionId) args.sessionId = tool.schema.string().describe("Explicit target session ID for reinjection")
  return args
}

// ─────────────────────────────────────────────────────────────
// Plugin entry
// ─────────────────────────────────────────────────────────────

export default async function plugin(ctx) {
  runtimeClient = ctx.client
  runtimeDirectory = ctx.directory

  // Phase 2: start single central controller
  startController()
  // Preserve startup hydration
  hydrateController()

  // Phase 7: normalize store on startup
  hydrateOnRestart()

  return {
    tool: {
      "sp-session-id": tool({
        description: "Return the current OpenCode session ID.",
        args: {},
        async execute(_args, context) {
          if (!context?.sessionID) throw new Error("sp-session-id requires sessionID in ToolContext")
          return [`SessionID: ${context.sessionID}`, `TimezoneDefault: ${DEFAULT_TIMEZONE_LABEL} (${DEFAULT_TIMEZONE})`].join("\n")
        },
      }),

      "sp-schedule": tool({
        description:
          "Canonical scheduler tool. Schedule a prompt into the current session. " +
          `Default timezone: ${DEFAULT_TIMEZONE_LABEL} (${DEFAULT_TIMEZONE}).`,
        args: scheduleArgsSchema(false),
        async execute(args, context) {
          const task = schedulePrompt(args, context)
          return formatTaskSummary(task)
        },
      }),

      "sp-schedule-to": tool({
        description:
          "Canonical cross-session scheduler tool. Schedule a prompt into an explicit target session ID. " +
          `Default timezone: ${DEFAULT_TIMEZONE_LABEL} (${DEFAULT_TIMEZONE}).`,
        args: scheduleArgsSchema(true),
        async execute(args, context) {
          const task = schedulePromptToSession(args, context)
          return formatTaskSummary(task, { callerSession: context.sessionID })
        },
      }),

      "sp-list": tool({
        description: "Canonical scheduler list tool.",
        args: {},
        async execute() {
          return formatTaskList(listTasks())
        },
      }),

      "sp-cancel": tool({
        description: "Canonical scheduler cancel tool.",
        args: { taskId: tool.schema.string().describe("ID of the task to cancel") },
        async execute(args) {
          if (!args.taskId) throw new Error("sp-cancel requires taskId")
          const found = cancelTask(args.taskId)
          return found ? `Cancelled: ${args.taskId}` : `Not found: ${args.taskId}`
        },
      }),

      "sp-get": tool({
        description: "Get full details for one scheduled task by ID.",
        args: { taskId: tool.schema.string().describe("ID of the task to inspect") },
        async execute(args) {
          const task = getTask(args.taskId)
          if (!task) return `Not found: ${args.taskId}`
          return formatTaskDetails(task)
        },
      }),

      "sp-update": tool({
        description: "Update an existing scheduled task without recreating it.",
        args: {
          taskId: tool.schema.string().describe("ID of the task to update"),
          sessionId: tool.schema.string().optional().describe("Optional new target session ID"),
          prompt: tool.schema.string().optional().describe("Updated prompt text"),
          mode: tool.schema.string().optional().describe('Optional new mode: "once", "interval", or "daily"'),
          timezone: tool.schema.string().optional().describe(`Optional timezone (default: ${DEFAULT_TIMEZONE_LABEL} / ${DEFAULT_TIMEZONE})`),
          noReply: tool.schema.string().optional().describe('Inject context without triggering AI response: true/false'),
          runAt: tool.schema.string().optional().describe("Updated ISO/local datetime for once mode"),
          delaySeconds: tool.schema.number().optional().describe("Updated delay for once mode"),
          everySeconds: tool.schema.number().optional().describe("Updated interval seconds"),
          time: tool.schema.string().optional().describe("Updated HH:mm for daily mode"),
        },
        async execute(args, context) {
          const task = updateTaskDefinition(args.taskId, { ...args, agent: context.agent })
          return ["Updated task:", formatTaskDetails(task)].join("\n\n")
        },
      }),

      "sp-clear": tool({
        description: "Clear scheduled tasks in bulk.",
        args: {
          filter: tool.schema.string().optional().describe('Which tasks to remove: "all" (default), "pending", "executed", or "failed"'),
        },
        async execute(args) {
          const filter = args.filter ?? "all"
          if (!["all", "pending", "executed", "failed"].includes(filter)) {
            throw new Error('sp-clear filter must be one of: all, pending, executed, failed')
          }
          const result = clearTasks(filter)
          return `Cleared ${result.removed} task(s). Remaining: ${result.remaining}`
        },
      }),
    },
  }
}
