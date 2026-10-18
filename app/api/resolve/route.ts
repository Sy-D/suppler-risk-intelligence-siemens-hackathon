import { spawn } from "node:child_process"
import path from "node:path"

const AGENT_DIR = path.join(process.cwd(), "deep-research-agent")
const PYTHON_BIN = process.env.ANALYST_PYTHON ?? ".venv/bin/python"

function resolve(name: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(PYTHON_BIN, ["app.py", "--resolve", name], {
      cwd: AGENT_DIR,
    })
    let stdout = ""
    proc.stdout.on("data", (chunk) => (stdout += chunk))
    proc.on("close", (code) => {
      try {
        if (code !== 0) reject(new Error(`resolver exited ${code}`))
        else resolvePromise(JSON.parse(stdout).canonical ?? name)
      } catch {
        resolvePromise(name)
      }
    })
    proc.on("error", reject)
    setTimeout(() => {
      proc.kill()
      reject(new Error("resolve timed out"))
    }, 30000)
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const name = String(body?.name ?? "")
    .trim()
    .slice(0, 200)
  if (!name) {
    return Response.json({ error: "Missing name" }, { status: 400 })
  }
  try {
    return Response.json({ canonical: await resolve(name) })
  } catch {
    return Response.json({ canonical: name })
  }
}
