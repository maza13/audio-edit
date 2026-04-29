import { tool } from "@opencode-ai/plugin/tool"
import { existsSync, readFileSync, writeFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const STORE = join(__dirname, "schedule.json")

const timers = new Map()
let runtimeClient = null
let runtimeDirectory = null

function loadStore() {
  if (!existsSync(STORE)) return { version: "1.1.0", tasks: [] }
  try {
    return JSON.parse(readFileSync(STORE, "utf-8"))
  } catch {
    return { version: "1.1.0", tasks: [] }
  }
}

function saveStore(store) {
  writeFileSync(STORE, JSON.stringify(store, null, 2), "utf-8")
}

function makeId() {
  return `sched-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function sendToMotherSession(task) {
  if (!runtimeClient) throw new Error("Scheduler runtime client unavailable")
  if (!task.motherSessionID) throw new Error("Task is missing motherSessionID")

  await runtimeClient.session.prompt({
    path: { id: task.motherSessionID },
    body: {
      noReply: false,
      agent: task.motherAgent,
      parts: [{ type: "text", text: task.prompt }],
    },
  })
}

function updateTask(taskId, updater) {
  const store = loadStore()
  store.tasks = store.tasks.map((task) => (task.id === taskId ? updater(task) : task))
  saveStore(store)
}

function markExecuted(taskId) {
  updateTask(taskId, (task) => ({
    ...task,
    status: "executed",
    executedAt: new Date().toISOString(),
  }))
}

function markFailed(taskId, error) {
  updateTask(taskId, (task) => ({
    ...task,
    status: "failed",
    error: String(error?.message ?? error),
    failedAt: new Date().toISOString(),
  }))
}

function armTask(task) {
  if (timers.has(task.id)) clearTimeout(timers.get(task.id))

  const delayMs = Math.max(0, new Date(task.runAt).getTime() - Date.now())
  const handle = setTimeout(async () => {
    try {
      const fresh = loadStore().tasks.find((item) => item.id === task.id)
      if (!fresh || fresh.status !== "pending") return
      await sendToMotherSession(fresh)
      markExecuted(task.id)
    } catch (error) {
      markFailed(task.id, error)
    }
  }, delayMs)

  timers.set(task.id, handle)
}

function hydrateTimers() {
  const store = loadStore()
  for (const task of store.tasks) {
    if (task.status === "pending") armTask(task)
  }
}

function scheduleTask({ prompt, delaySeconds }, context) {
  if (!context?.sessionID) {
    throw new Error("schedule-prompt requires sessionID in ToolContext")
  }

  const store = loadStore()
  const task = {
    id: makeId(),
    motherSessionID: context.sessionID,
    motherAgent: context.agent,
    directory: context.directory ?? runtimeDirectory,
    prompt,
    runAt: new Date(Date.now() + delaySeconds * 1000).toISOString(),
    status: "pending",
    createdAt: new Date().toISOString(),
  }

  store.tasks.push(task)
  saveStore(store)
  armTask(task)
  return task
}

export default async function plugin(ctx) {
  runtimeClient = ctx.client
  runtimeDirectory = ctx.directory

  hydrateTimers()

  return {
    tool: {
      "schedule-prompt": tool({
        description:
          "Schedule a prompt and re-inject it into the mother/origin OpenCode session after a delay.",
        args: {
          prompt: tool.schema.string().describe("Prompt to send later"),
          delaySeconds: tool.schema.number().int().positive().describe("Delay in seconds"),
        },
        async execute(args, context) {
          const task = scheduleTask(args, context)
          return [
            `Scheduled: ${task.id}`,
            `MotherSession: ${task.motherSessionID}`,
            `RunAt: ${task.runAt}`,
            `Status: ${task.status}`,
          ].join("\n")
        },
      }),
    },
  }
}
