"use client"

import { useSyncExternalStore } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { X, MousePointer2, MapPin, ArrowUpRight } from "lucide-react"
import Link from "next/link"
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
import { RiskBadge } from "./risk-badge"
import { RiskBar } from "./risk-bar"
import { DimensionGroups } from "./dimension-groups"
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
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={supplier.level} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {supplier.region}, {supplier.regionCountry}
                </span>
              </div>
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
                    animate={false}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">PO exposure</dt>
                <dd className="mt-1 tabular-nums">
                  <AnimatedNumber
                    value={supplier.exposure}
                    format={exposureFormat}
                    animate={false}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Sourcing risk</dt>
                <dd className="mt-1">{supplier.sourcing}</dd>
              </div>
            </dl>
            <div className="border-t pt-4">
              <DimensionGroups supplier={supplier} />
            </div>
            <Button
              className="min-h-11 w-full"
              variant={selected ? "outline" : "default"}
              onClick={onToggle}
            >
              {selected ? "Remove from selection" : "Add to comparison"}
            </Button>
            <Button
              className="w-full"
              variant="ghost"
              size="sm"
              nativeButton={false}
              render={<Link href={`/supplier/${supplier.id}`} />}
            >
              Full detail view
              <ArrowUpRight data-icon="inline-end" />
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
