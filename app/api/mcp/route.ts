import { spawn } from "node:child_process"
import path from "node:path"
import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { getSuppliers } from "@/lib/supplier-data"
import { concentrationWarnings } from "@/lib/concentration"
import { regionForSupplier } from "@/lib/geo"

const text = <T extends object>(data: T) => {
  // SAFETY: MCP tool responses are content blocks typed as "text".
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

const AGENT_DIR = path.join(process.cwd(), "deep-research-agent")
const PYTHON_BIN = process.env.ANALYST_PYTHON ?? ".venv/bin/python"

function research(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, ["app.py", "--json", name], {
      cwd: AGENT_DIR,
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      proc.kill()
      reject(new Error("Research timed out"))
    }, 5 * 60 * 1000)
    proc.stdout.on("data", (chunk) => (stdout += chunk))
    proc.stderr.on("data", (chunk) => (stderr += chunk))
    proc.on("error", reject)
    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `agent exited ${code}`))
    })
  })
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_suppliers",
      {
        description:
          "Search the supplier portfolio by name or id fragment. Optional risk level filter.",
        inputSchema: {
          query: z.string().optional(),
          level: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
          limit: z.number().int().min(1).max(50).default(10),
        },
      },
      async ({ query = "", level, limit }) => {
        const needle = query.toLowerCase()
        const matches = (await getSuppliers())
          .filter(
            (s) =>
              (!level || s.level === level) &&
              (s.name.toLowerCase().includes(needle) ||
                s.id.toLowerCase().includes(needle))
          )
          .slice(0, limit)
        return text(matches)
      }
    )

    server.registerTool(
      "get_supplier",
      {
        description:
          "Full risk profile for one supplier id (SUPP_##### or RSCH_#####), including region and hazard exposure.",
        inputSchema: { id: z.string() },
      },
      async ({ id }) => {
        const supplier = (await getSuppliers()).find((s) => s.id === id)
        if (!supplier) return text({ error: `No supplier ${id}` })
        return text({ ...supplier, hazards: regionForSupplier(id).hazards })
      }
    )

    server.registerTool(
      "compare_suppliers",
      {
        description:
          "Side-by-side risk comparison plus concentration-risk warnings for up to 20 supplier ids.",
        inputSchema: { ids: z.array(z.string()).min(2).max(20) },
      },
      async ({ ids }) => {
        const all = await getSuppliers()
        const suppliers = ids
          .map((id) => all.find((s) => s.id === id))
          .filter((s) => s !== undefined)
        return text({
          suppliers,
          concentration_warnings: concentrationWarnings(suppliers),
        })
      }
    )

    server.registerTool(
      "portfolio_stats",
      {
        description: "Portfolio-level aggregates: counts, average risk, exposure.",
        inputSchema: {},
      },
      async () => {
        const all = await getSuppliers()
        const risky = all.filter(
          (s) => s.level === "High" || s.level === "Critical"
        ).length
        return text({
          suppliers: all.length,
          average_risk:
            Math.round(
              (all.reduce((sum, s) => sum + s.risk, 0) / all.length) * 10
            ) / 10,
          high_or_critical: risky,
          exposure_eur: all.reduce((sum, s) => sum + s.exposure, 0),
        })
      }
    )

    server.registerTool(
      "research_supplier",
      {
        description:
          "Run the deep-research agent on a real company name. Takes 1–5 minutes; returns scored risk row with sources.",
        inputSchema: { name: z.string().min(1).max(200) },
      },
      async ({ name }) => {
        try {
          const result = await research(name)
          return text({ supplier: JSON.parse(result) })
        } catch (error) {
          return text({
            error: error instanceof Error ? error.message : "research failed",
          })
        }
      }
    )
  },
  {
    serverInfo: { name: "supplier-risk-intelligence", version: "0.1.0" },
  }
)

export { handler as GET, handler as POST }
