import { spawn } from "node:child_process"
import path from "node:path"

const AGENT_DIR = path.join(process.cwd(), "deep-research-agent")
const PYTHON_BIN = process.env.ANALYST_PYTHON ?? ".venv/bin/python"
const TIMEOUT_MS = 5 * 60 * 1000

function runResearch(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, ["app.py", "--json", name], { cwd: AGENT_DIR })
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

function toSupplier(row: Record<string, string | number>) {
  return {
    id: String(row.supplierID).replace("SUPP_", "RSCH_"),
    name: String(row["Supplier Name"]),
    risk: Number(row.Total_Risk_Index),
    level: String(row.Total_Risk_Index_Level),
    financial: Number(row.Financial_Health_Score),
    quality: Number(row.Quality_Risk_Score),
    operational: Number(row.Operational_Resilience_Score),
    compliance: Number(row.Compliance_Risk_Score),
    esg: Number(row.ESG_Performance_Score),
    digital: Number(row.Digital_Security_Score),
    governance: Number(row.Governance_Risk_Score),
    credit: Number(row.Credit_Rating_Score),
    delivery: 0,
    exposure: 0,
    sourcing: String(row["Sourcing Risk Level"]),
    researched: true,
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const name = String(body?.name ?? "")
    .trim()
    .slice(0, 200)
  if (!name) {
    return Response.json({ error: "Missing supplier name" }, { status: 400 })
  }
  try {
    const output = await runResearch(name)
    const result = JSON.parse(output)
    const first = result?.suppliers?.[0]
    if (!first?.row) {
      return Response.json({ error: "Agent returned no row" }, { status: 502 })
    }
    return Response.json({
      supplier: toSupplier(first.row),
      reasoning: first.reasoning,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Research agent failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
