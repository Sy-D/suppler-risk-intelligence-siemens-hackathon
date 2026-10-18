import { spawn } from "node:child_process"
import { z } from "zod"

// Interpreter and script are configurable via env; paths resolve from the
// repo root (cwd). Docker sets ANALYST_PYTHON to the system python3.
const PYTHON_BIN = process.env.ANALYST_PYTHON ?? ".venv/bin/python"
const ANALYST_SCRIPT = process.env.ANALYST_SCRIPT ?? "scripts/ask.py"
const TIMEOUT_MS = 3 * 60 * 1000
// scripts/ask.py rejects questions longer than this.
const MAX_QUESTION_CHARS = 500
const MAX_CONTEXT_CHARS = 4000

const context = z.string().max(MAX_CONTEXT_CHARS * 2).catch("")
const requestBody = z.object({
  question: z.string(),
  // The previous turn of the chat, used to resolve follow-up questions.
  previous: z
    .object({ question: context, sql: context, answer: context })
    .optional()
    .catch(undefined),
})
const analystOutput = z.object({ sql: z.string(), answer: z.string() })

type Turn = z.output<typeof analystOutput>
type Previous = NonNullable<z.output<typeof requestBody>["previous"]>

function runAnalyst(question: string, previous?: Previous): Promise<Turn> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      PYTHON_BIN,
      [ANALYST_SCRIPT, question, "--json", "--context-stdin"],
      { cwd: process.cwd(), env: process.env }
    )
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error("Analyst timed out after 3 minutes"))
    }, TIMEOUT_MS)
    proc.stdout.on("data", (chunk) => (stdout += chunk))
    proc.stderr.on("data", (chunk) => (stderr += chunk))
    proc.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(stderr.trim() || `analyst exited with code ${code}`))
        return
      }
      try {
        resolve(analystOutput.parse(JSON.parse(stdout)))
      } catch {
        reject(new Error("Analyst returned an unexpected response"))
      }
    })
    proc.stdin.end(previous ? JSON.stringify(previous) : "")
  })
}

export async function POST(request: Request) {
  const body = requestBody.safeParse(
    await request.json().catch(() => undefined)
  )
  const question = (body.success ? body.data.question : "")
    .trim()
    .slice(0, MAX_QUESTION_CHARS)
  if (!body.success || !question) {
    return Response.json({ error: "Missing question" }, { status: 400 })
  }
  try {
    return Response.json(await runAnalyst(question, body.data.previous))
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analyst failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
