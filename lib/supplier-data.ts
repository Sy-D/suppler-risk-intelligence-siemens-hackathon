import "server-only"

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { cache } from "react"
import { DuckDBInstance } from "@duckdb/node-api"
import { z } from "zod"
import { coordinatesForSupplier, regionForSupplier } from "@/lib/geo"

const score = z.coerce.number().int().min(0).max(100)
const supplierRow = z
  .object({
    supplierID: z.string().regex(/^(SUPP|RSCH)_\d{5}$/),
    "Supplier Name": z.string().min(1),
    Total_Risk_Index: score,
    Total_Risk_Index_Level: z.enum(["Low", "Medium", "High", "Critical"]),
    Industry_Benchmark_Score: score,
    Media_Sentiment_Score: score,
    External_Intelligence_Score: score,
    Sub_Tier_Visibility_Score: score,
    Labor_Stability_Score: score,
    Financial_Health_Score: score,
    Compliance_Risk_Score: score,
    Safety_Incident_Score: score,
    Environmental_Exposure_Score: score,
    ESG_Performance_Score: score,
    Digital_Security_Score: score,
    Operational_Resilience_Score: score,
    Market_Sentiment_Score: score,
    Quality_Risk_Score: score,
    Governance_Risk_Score: score,
    Geopolitical_Risk_Score: score,
    Political_Stability_Score: score,
    Credit_Rating_Score: score,
    "Supplier Delivery Rating": z.coerce.number().min(0).max(100),
    "Purchase Order Volume (EUR)": z.coerce.number().min(0),
    "Sourcing Risk Level": z.enum(["Low", "Medium", "High", "Critical"]),
    "HQ City": z.string().nullable().optional(),
    "HQ Country": z.string().nullable().optional(),
    Website: z.string().nullable().optional(),
    "Contact Email": z.string().nullable().optional(),
  })
  .transform((row) => ({
    id: row.supplierID,
    name: row["Supplier Name"],
    risk: row.Total_Risk_Index,
    level: row.Total_Risk_Index_Level,
    financial: row.Financial_Health_Score,
    quality: row.Quality_Risk_Score,
    operational: row.Operational_Resilience_Score,
    compliance: row.Compliance_Risk_Score,
    esg: row.ESG_Performance_Score,
    digital: row.Digital_Security_Score,
    governance: row.Governance_Risk_Score,
    credit: row.Credit_Rating_Score,
    benchmark: row.Industry_Benchmark_Score,
    media: row.Media_Sentiment_Score,
    intel: row.External_Intelligence_Score,
    subTier: row.Sub_Tier_Visibility_Score,
    labor: row.Labor_Stability_Score,
    safety: row.Safety_Incident_Score,
    environmental: row.Environmental_Exposure_Score,
    market: row.Market_Sentiment_Score,
    geopolitical: row.Geopolitical_Risk_Score,
    political: row.Political_Stability_Score,
    delivery: row["Supplier Delivery Rating"],
    exposure: row["Purchase Order Volume (EUR)"],
    sourcing: row["Sourcing Risk Level"],
    hqCity: row["HQ City"] ?? undefined,
    hqCountry: row["HQ Country"] ?? undefined,
    website: row.Website ?? undefined,
    contactEmail: row["Contact Email"] ?? undefined,
    researched: row.supplierID.startsWith("RSCH_") ? true : undefined,
    region: regionForSupplier(row.supplierID).name,
    regionCountry: regionForSupplier(row.supplierID).country,
    ...coordinatesForSupplier(row.supplierID),
  }))

export type Supplier = z.output<typeof supplierRow>
export type RiskLevel = Supplier["level"]

const DATASET_CSV = join(process.cwd(), "data", "supplier_risk_dataset.csv")
const RESEARCH_CSV = join(
  process.cwd(),
  "deep-research-agent",
  "output",
  "suppliers.csv"
)

const SCORE_COLUMNS = [
  "Industry_Benchmark_Score",
  "Media_Sentiment_Score",
  "External_Intelligence_Score",
  "Sub_Tier_Visibility_Score",
  "Labor_Stability_Score",
  "Financial_Health_Score",
  "Compliance_Risk_Score",
  "Safety_Incident_Score",
  "Environmental_Exposure_Score",
  "ESG_Performance_Score",
  "Digital_Security_Score",
  "Operational_Resilience_Score",
  "Market_Sentiment_Score",
  "Quality_Risk_Score",
  "Governance_Risk_Score",
  "Geopolitical_Risk_Score",
  "Political_Stability_Score",
  "Credit_Rating_Score",
]

const CONTACT_COLUMNS = [
  '"HQ City"',
  '"HQ Country"',
  '"Website"',
  '"Contact Email"',
]

const COLUMNS = [
  "supplierID",
  '"Supplier Name"',
  "Total_Risk_Index",
  "Total_Risk_Index_Level",
  ...SCORE_COLUMNS,
  '"Supplier Delivery Rating"',
  '"Purchase Order Volume (EUR)"',
  '"Sourcing Risk Level"',
  ...CONTACT_COLUMNS.map((col) => `NULL AS ${col}`),
].join(", ")

const connection = DuckDBInstance.create().then((instance) =>
  instance.connect()
)

/** Contact columns only exist in research CSVs written after the schema
 * extension — select them when present, NULL otherwise. */
function researchContactExpr(quoted: string) {
  const name = quoted.replaceAll('"', "")
  try {
    const header = readFileSync(RESEARCH_CSV, "utf8").split("\n", 1)[0]
    if (header.split(",").map((c) => c.trim().replaceAll('"', "")).includes(name)) {
      return quoted
    }
  } catch {
    // File unreadable — treat as missing column.
  }
  return `NULL AS ${quoted}`
}

async function readSupplierRows() {
  const conn = await connection
  // Agent-researched rows are remapped to the RSCH_ id space so they never
  // collide with the anonymized SUPP_ dataset ids.
  const research = existsSync(RESEARCH_CSV)
    ? `UNION ALL SELECT REPLACE(t.supplierID, 'SUPP_', 'RSCH_') AS supplierID,
         "Supplier Name", Total_Risk_Index, Total_Risk_Index_Level,
         ${SCORE_COLUMNS.join(", ")},
         "Supplier Delivery Rating", "Purchase Order Volume (EUR)",
         "Sourcing Risk Level",
         ${CONTACT_COLUMNS.map((col) => researchContactExpr(col)).join(", ")}
       FROM read_csv('${RESEARCH_CSV}', all_varchar = true) t`
    : ""
  const dataset = `SELECT ${COLUMNS} FROM read_csv('${DATASET_CSV}', all_varchar = true)`
  try {
    const result = await conn.runAndReadAll(`${dataset} ${research}`)
    return result.getRowObjects()
  } catch (error) {
    if (!research) throw error
    // A malformed research CSV must not take down the whole dashboard.
    console.error("Skipping unreadable research CSV:", error)
    const result = await conn.runAndReadAll(dataset)
    return result.getRowObjects()
  }
}

export const getSuppliers = cache(async () => {
  const rows = await readSupplierRows()
  return z.array(supplierRow).parse(rows)
})
