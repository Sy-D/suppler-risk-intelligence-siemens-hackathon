import { SupplierDashboard } from "@/components/dashboard/supplier-dashboard"
import { getSuppliers } from "@/lib/supplier-data"

// Researched suppliers land in deep-research-agent/output/suppliers.csv at
// request time — render per request instead of prerendering at build.
export const dynamic = "force-dynamic"

export default async function Page() {
  const suppliers = await getSuppliers()
  return <SupplierDashboard suppliers={suppliers} />
}
