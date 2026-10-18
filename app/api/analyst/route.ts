import { spawn } from "node:child_process"
import path from "node:path"

const AGENT_DIR = path.join(process.cwd(), "deep-research-agent")
const PYTHON_BIN = process.env.ANALYST_PYTHON ?? ".venv/bin/python"
const TIMEOUT_MS = 5 * 60 * 1000

function runAnalyst(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, ["analyst.py", question], { cwd: AGENT_DIR })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error("Research timed out after 5 minutes"))
    }, TIMEOUT_MS)
    proc.stdout.on("data", (chunk) => (stdout += chunk))
    proc.stderr.on("data", (chunk) => (stderr += chunk))
    proc.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `agent exited with code ${code}`))
    })
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const question = String(body?.question ?? "")
    .trim()
    .slice(0, 2000)
  if (!question) {
    return Response.json({ error: "Missing question" }, { status: 400 })
  }
  try {
    const answer = await runAnalyst(question)
    return Response.json({ answer })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research agent failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
