import "server-only"

import { spawn } from "node:child_process"
import path from "node:path"

const AGENT_DIR = path.join(process.cwd(), "deep-research-agent")
const PYTHON_BIN = process.env.ANALYST_PYTHON ?? ".venv/bin/python"
const TIMEOUT_MS = 5 * 60 * 1000

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

type StreamEvent =
  | { type: "progress"; text: string }
  | { type: "result"; payload: JsonValue }
  | { type: "error"; message: string }

/** Spawn a deep-research-agent script and stream it back as SSE.
 * stderr `PROGRESS|label|text` lines become `progress` events; on exit the
 * stdout is mapped through `mapResult` into the final `result` event. */
export function agentEventStream(
  scriptArgs: string[],
  mapResult: (stdout: string) => JsonValue
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: StreamEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        )
      let stdout = ""
      const proc = spawn(PYTHON_BIN, scriptArgs, { cwd: AGENT_DIR })
      const timer = setTimeout(() => {
        proc.kill()
        send({ type: "error", message: "Research timed out after 5 minutes" })
        controller.close()
      }, TIMEOUT_MS)
      proc.stdout.on("data", (chunk) => (stdout += chunk))
      proc.stderr.on("data", (chunk) => {
        for (const line of String(chunk).split("\n")) {
          const trimmed = line.trim()
          if (trimmed.startsWith("PROGRESS|")) {
            send({ type: "progress", text: trimmed.slice(9) })
          }
        }
      })
      proc.on("error", (error) => {
        clearTimeout(timer)
        send({ type: "error", message: error.message })
        controller.close()
      })
      proc.on("close", (code) => {
        clearTimeout(timer)
        try {
          if (code !== 0) throw new Error(`agent exited with code ${code}`)
          send({ type: "result", payload: mapResult(stdout.trim()) })
        } catch (error) {
          send({
            type: "error",
            message:
              error instanceof Error ? error.message : "Research agent failed",
          })
        }
        controller.close()
      })
    },
  })
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  })
}
