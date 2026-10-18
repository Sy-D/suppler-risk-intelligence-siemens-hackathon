import { agentEventStream } from "@/lib/agent-stream"

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
    lastModified: String(row["Last Modified"] ?? ""),
    researched: true,
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const name = String(body?.name ?? "")
    .trim()
    .slice(0, 200)
  const updateId = String(body?.updateId ?? "")
    .trim()
    .slice(0, 20)
  if (!name) {
    return Response.json({ error: "Missing supplier name" }, { status: 400 })
  }
  const args = ["app.py", "--json"]
  if (updateId) args.push("--update-id", updateId.replace("RSCH_", "SUPP_"))
  args.push(name)
  return agentEventStream(args, (stdout) => {
    const result = JSON.parse(stdout)
    const first = result?.suppliers?.[0]
    if (!first?.row) {
      throw new Error("Agent returned no row")
    }
    return { supplier: toSupplier(first.row), reasoning: first.reasoning }
  })
}
