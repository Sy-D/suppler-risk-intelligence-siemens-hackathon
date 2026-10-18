import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { cache } from "react"
import { parse } from "csv-parse/sync"
import { z } from "zod"

const score = z.coerce.number().int().min(0).max(100)
const supplierRow = z
  .object({
    supplierID: z.string().regex(/^SUPP_\d{5}$/),
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
    "Sourcing Risk Level": z.enum(["Low", "Medium", "High"]),
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
  }))

export type Supplier = z.output<typeof supplierRow>
export type RiskLevel = Supplier["level"]

export const getSuppliers = cache(async () => {
  const csv = await readFile(
    join(process.cwd(), "data", "supplier_risk_dataset.csv"),
    "utf8"
  )
  return z
    .array(supplierRow)
    .parse(parse(csv, { columns: true, skip_empty_lines: true }))
})
