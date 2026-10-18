import "server-only"

import { existsSync } from "node:fs"
import { join } from "node:path"
import { cache } from "react"
import { DuckDBInstance } from "@duckdb/node-api"
import { z } from "zod"

const score = z.coerce.number().int().min(0).max(100)
const supplierRow = z
  .object({
    supplierID: z.string().regex(/^(SUPP|RSCH)_\d{5}$/),
    "Supplier Name": z.string().min(1),
    Total_Risk_Index: score,
    Total_Risk_Index_Level: z.enum(["Low", "Medium", "High", "Critical"]),
    Financial_Health_Score: score,
    Quality_Risk_Score: score,
    Operational_Resilience_Score: score,
    Compliance_Risk_Score: score,
    ESG_Performance_Score: score,
    Digital_Security_Score: score,
    Governance_Risk_Score: score,
    Credit_Rating_Score: score,
    "Supplier Delivery Rating": z.coerce.number().min(0).max(100),
    "Purchase Order Volume (EUR)": z.coerce.number().min(0),
    "Sourcing Risk Level": z.enum(["Low", "Medium", "High", "Critical"]),
    "Last Modified": z.string().default(""),
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
    delivery: row["Supplier Delivery Rating"],
    exposure: row["Purchase Order Volume (EUR)"],
    sourcing: row["Sourcing Risk Level"],
    lastModified: row["Last Modified"] || undefined,
    researched: row.supplierID.startsWith("RSCH_") ? true : undefined,
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

const COLUMNS = [
  "supplierID",
  '"Supplier Name"',
  "Total_Risk_Index",
  "Total_Risk_Index_Level",
  "Financial_Health_Score",
  "Quality_Risk_Score",
  "Operational_Resilience_Score",
  "Compliance_Risk_Score",
  "ESG_Performance_Score",
  "Digital_Security_Score",
  "Governance_Risk_Score",
  "Credit_Rating_Score",
  '"Supplier Delivery Rating"',
  '"Purchase Order Volume (EUR)"',
  '"Sourcing Risk Level"',
].join(", ")

const connection = DuckDBInstance.create().then((instance) =>
  instance.connect()
)

async function readSupplierRows() {
  const conn = await connection
  // Agent-researched rows are remapped to the RSCH_ id space so they never
  // collide with the anonymized SUPP_ dataset ids.
  const research = existsSync(RESEARCH_CSV)
    ? `UNION ALL SELECT REPLACE(supplierID, 'SUPP_', 'RSCH_') AS supplierID,
         "Supplier Name", Total_Risk_Index, Total_Risk_Index_Level,
         Financial_Health_Score, Quality_Risk_Score, Operational_Resilience_Score,
         Compliance_Risk_Score, ESG_Performance_Score, Digital_Security_Score,
         Governance_Risk_Score, Credit_Rating_Score,
         "Supplier Delivery Rating", "Purchase Order Volume (EUR)",
         "Sourcing Risk Level", "Last Modified"
       FROM read_csv('${RESEARCH_CSV}', all_varchar = true)`
    : ""
  const result = await conn.runAndReadAll(
    `SELECT ${COLUMNS}, '' AS "Last Modified"
     FROM read_csv('${DATASET_CSV}', all_varchar = true)
     ${research}`
  )
  return result.getRowObjects()
}

export const getSuppliers = cache(async () => {
  const rows = await readSupplierRows()
  return z.array(supplierRow).parse(rows)
})
