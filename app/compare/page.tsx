import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ComparisonTable, ConcentrationAlerts } from "@/components/dashboard/workspace-panels"
import { getSuppliers } from "@/lib/supplier-data"

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>
}) {
  const { ids } = await searchParams
  const wanted = new Set((ids ?? "").split(",").filter(Boolean))
  const suppliers = (await getSuppliers()).filter((s) => wanted.has(s.id))

  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 mb-2"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <ArrowLeft data-icon="inline-start" />
            Back to workspace
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Compare your shortlist
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {suppliers.length} suppliers · Risk scores: 0 = no risk, 100 =
            maximum risk.
          </p>
        </div>
      </div>
      {suppliers.length === 0 ? (
        <p className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          No suppliers found for these IDs. Select suppliers in the workspace
          and open the comparison again.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card p-6">
          <ConcentrationAlerts suppliers={suppliers} />
          <ComparisonTable suppliers={suppliers} />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Source: supplier_risk_dataset.csv. Higher delivery ratings are better.
        Risk weights and component suitability are not provided.
      </p>
    </main>
  )
}
