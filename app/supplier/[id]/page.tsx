import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, Globe, Mail, MapPin, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RiskBadge } from "@/components/dashboard/risk-badge"
import { RiskBar } from "@/components/dashboard/risk-bar"
import { DimensionGroups } from "@/components/dashboard/dimension-groups"
import { SupplierMap } from "@/components/dashboard/supplier-map"
import { ClimateStrip } from "@/components/dashboard/climate-strip"
import { getSuppliers } from "@/lib/supplier-data"
import { regionForSupplier, HAZARD_META, type HazardKind } from "@/lib/geo"
import { euro } from "@/lib/risk"

const deliveryFormat = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default async function SupplierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supplier = (await getSuppliers()).find((s) => s.id === id)
  if (!supplier) notFound()

  const region = regionForSupplier(supplier.id)
  // SAFETY: GeoRegion.hazards keys are exactly the HazardKind union.
  const hazards = (Object.entries(region.hazards) as [HazardKind, number][])
    .filter(([, level]) => level > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-4 sm:p-6 lg:p-8">
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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {supplier.name}
          </h1>
          <RiskBadge level={supplier.level} />
          {supplier.researched && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
              Web-researched
            </span>
          )}
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm text-muted-foreground">
          <span>{supplier.id}</span>
          <span className="inline-flex items-center gap-1 font-sans">
            <MapPin className="size-3.5" />
            {region.name}, {region.country}
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Location &amp; exposure</CardTitle>
            <CardDescription>
              {region.seasonLabel}
              {hazards.length > 0 &&
                ` · ${hazards
                  .map(([kind, level]) => `${HAZARD_META[kind].label} ${level}/3`)
                  .join(", ")}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SupplierMap supplier={supplier} />
            <ClimateStrip
              lat={supplier.lat}
              lon={supplier.lon}
              region={region}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Key figures</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Total risk · lower is better
                </p>
                <div className="flex items-center gap-3">
                  <span className="w-8 text-2xl font-medium tabular-nums">
                    {supplier.risk}
                  </span>
                  <RiskBar value={supplier.risk} />
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Delivery</dt>
                  <dd className="mt-1 tabular-nums">
                    {supplier.researched
                      ? "—"
                      : `${deliveryFormat.format(supplier.delivery)}%`}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">PO exposure</dt>
                  <dd className="mt-1 tabular-nums">
                    {supplier.researched ? "—" : euro.format(supplier.exposure)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    Sourcing risk
                  </dt>
                  <dd className="mt-1">{supplier.sourcing}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Level</dt>
                  <dd className="mt-1">{supplier.level}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {supplier.researched ? (
                <>
                  {supplier.hqCity || supplier.hqCountry ? (
                    <p className="flex items-start gap-2">
                      <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {[supplier.hqCity, supplier.hqCountry]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ) : null}
                  {supplier.website ? (
                    <p className="flex items-start gap-2">
                      <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <a
                        className="truncate underline underline-offset-2"
                        href={
                          supplier.website.startsWith("http")
                            ? supplier.website
                            : `https://${supplier.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {supplier.website}
                      </a>
                    </p>
                  ) : null}
                  {supplier.contactEmail ? (
                    <p className="flex items-start gap-2">
                      <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      {supplier.contactEmail}
                    </p>
                  ) : null}
                  {!supplier.hqCity &&
                    !supplier.hqCountry &&
                    !supplier.website &&
                    !supplier.contactEmail && (
                      <p className="text-muted-foreground">
                        Public contact details are collected in the research
                        report.
                      </p>
                    )}
                </>
              ) : (
                <>
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <Building2 className="mt-0.5 size-4 shrink-0" />
                    Anonymized dataset record — internal ERP entry, no public
                    contact fields.
                  </p>
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <Search className="mt-0.5 size-4 shrink-0" />
                    Run the research agent on the real company to pull HQ,
                    website and contacts from public sources.
                  </p>
                  <div className="flex items-center gap-3 pt-1 text-muted-foreground/60">
                    <Globe className="size-4" />
                    <Mail className="size-4" />
                    <span className="text-xs">
                      Populated after research run
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk dimensions</CardTitle>
          <CardDescription>
            All 18 scored attributes · 0–100, higher is riskier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DimensionGroups supplier={supplier} />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Location and hazard data are regional estimates for demo purposes.
        Climate: Open-Meteo ERA5.
      </p>
    </main>
  )
}
