"use client"

import { useSyncExternalStore } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { X, MousePointer2 } from "lucide-react"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AnimatedNumber,
  deliveryFormat,
  exposureFormat,
} from "./animated-number"
import { RiskBadge, riskDimensions } from "./risk-badge"
import { RiskBar } from "./risk-bar"
import type { Supplier } from "@/lib/supplier-data"

function SupplierDetailCard({
  supplier,
  onClose,
  selected,
  onToggle,
  hideClose = false,
}: {
  supplier: Supplier | null
  onClose: () => void
  selected: boolean
  onToggle: () => void
  hideClose?: boolean
}) {
  return (
    <Card
      className="xl:sticky xl:top-6"
      aria-label="Selected supplier information"
    >
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          Supplier profile
          {supplier && !hideClose && (
            <Button
              size="icon-lg"
              variant="ghost"
              aria-label="Close supplier profile"
              onClick={onClose}
            >
              <X />
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          {supplier ? supplier.id : "Select a point in the chart"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {supplier ? (
          <div
            key={supplier.id}
            className="space-y-5 motion-safe:animate-detail-in"
          >
            <div>
              <h2 className="mb-3 text-lg font-medium text-balance">
                {supplier.name}
              </h2>
              <RiskBadge level={supplier.level} />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Total risk · lower is better
              </p>
              <RiskBar value={supplier.risk} enter />
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Delivery</dt>
                <dd className="mt-1 tabular-nums">
                  <AnimatedNumber
                    value={supplier.delivery}
                    format={deliveryFormat}
                    suffix="%"
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">PO exposure</dt>
                <dd className="mt-1 tabular-nums">
                  <AnimatedNumber
                    value={supplier.exposure}
                    format={exposureFormat}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Sourcing risk</dt>
                <dd className="mt-1">{supplier.sourcing}</dd>
              </div>
            </dl>
            <div className="space-y-4 border-t pt-5">
              {riskDimensions.map((d) => (
                <div
                  key={d.key}
                  className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2 text-xs"
                >
                  <span className="text-muted-foreground">{d.label}</span>
                  <RiskBar value={supplier[d.key]} enter />
                </div>
              ))}
            </div>
            <Button
              className="min-h-11 w-full"
              variant={selected ? "outline" : "default"}
              onClick={onToggle}
            >
              {selected ? "Remove from selection" : "Add to comparison"}
            </Button>
            <p className="text-xs leading-relaxed text-muted-foreground">
              CSV snapshot · All risk scores: 0–100. Total risk weights are not
              supplied.
            </p>
          </div>
        ) : (
          <div className="py-6 text-sm leading-relaxed text-muted-foreground">
            <MousePointer2 className="mb-4 size-5" />
            Click a supplier point to inspect its risk drivers, delivery and
            exposure here. You can also choose a search suggestion above the
            chart.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(max-width: 1279px)")
  media.addEventListener("change", onChange)
  return () => media.removeEventListener("change", onChange)
}
function isCompact() {
  return window.matchMedia("(max-width: 1279px)").matches
}
function serverCompact() {
  return false
}
export function SupplierDetail(
  props: React.ComponentProps<typeof SupplierDetailCard>
) {
  const compact = useSyncExternalStore(subscribe, isCompact, serverCompact)
  if (!compact) return <SupplierDetailCard {...props} />
  return (
    <Sheet
      open={Boolean(props.supplier)}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <SheetContent className="w-[calc(100%-1rem)]! overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Supplier details</SheetTitle>
          <SheetDescription>
            Risk evidence from the supplier dataset.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <SupplierDetailCard {...props} hideClose />
        </div>
      </SheetContent>
    </Sheet>
  )
}
