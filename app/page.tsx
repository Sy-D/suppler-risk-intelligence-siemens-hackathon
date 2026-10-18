import { SupplierDashboard } from "@/components/dashboard/supplier-dashboard"
import { getSuppliers } from "@/lib/supplier-data"

export default async function Page() {
  const suppliers = await getSuppliers()
  return <SupplierDashboard suppliers={suppliers} />
}
