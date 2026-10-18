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

interface StreamOptions {
  /** Working directory for the script (default: deep-research-agent/). */
  cwd?: string
  /** Text written to the script's stdin (it is always closed). */
  stdin?: string
}

/** Spawn a Python script and stream it back as SSE.
 * stderr `PROGRESS|label|text` lines become `progress` events; on exit the
 * stdout is mapped through `mapResult` into the final `result` event. Other
 * stderr output becomes the error message if the script fails. */
export function agentEventStream(
  scriptArgs: string[],
  mapResult: (stdout: string) => JsonValue,
  { cwd = AGENT_DIR, stdin = "" }: StreamOptions = {}
): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (payload: StreamEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
        )
      let stdout = ""
      let stderr = ""
      const proc = spawn(PYTHON_BIN, scriptArgs, { cwd, env: process.env })
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
          } else if (trimmed) {
            stderr += `${trimmed}\n`
          }
        }
      })
      proc.on("error", (error) => {
        clearTimeout(timer)
        send({ type: "error", message: error.message })
        controller.close()
      })
      // Ignore EPIPE if the process exits (or fails to start) early.
      proc.stdin.on("error", () => {})
      proc.stdin.end(stdin)
      proc.on("close", (code) => {
        clearTimeout(timer)
        try {
          if (code !== 0) {
            throw new Error(stderr.trim() || `agent exited with code ${code}`)
          }
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
