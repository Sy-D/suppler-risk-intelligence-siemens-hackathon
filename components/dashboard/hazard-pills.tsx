"use client"

import { CalendarDays } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HAZARD_META, type GeoRegion, type HazardKind } from "@/lib/geo"

const LEVEL_TEXT = ["None", "Low", "Moderate", "High"]

const pillClass =
  "inline-flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs motion-safe:animate-detail-in"

function LevelMeter({ level, color }: { level: number; color: string }) {
  return (
    <span className="ml-0.5 flex items-center gap-[3px]" aria-hidden="true">
      {[0, 1, 2].map((step) => (
        <span
          key={step}
          className="h-1 w-2 rounded-full"
          style={{ background: step < level ? color : "var(--muted)" }}
        />
      ))}
    </span>
  )
}

export function HazardPills({ region }: { region: GeoRegion }) {
  // SAFETY: GeoRegion.hazards keys are exactly the HazardKind union.
  const hazards = (Object.entries(region.hazards) as [HazardKind, number][])
    .filter(([, level]) => level > 0)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="flex flex-wrap gap-1.5">
      <Tooltip>
        <TooltipTrigger
          render={
            <span className={pillClass} style={{ animationDelay: "0ms" }}>
              <CalendarDays className="size-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {region.seasonLabel}
              </span>
            </span>
          }
        />
        <TooltipContent side="top">
          {region.season.length > 0
            ? `Seasonal disruption window: ${region.seasonLabel}`
            : "No recurring seasonal disruption window for this region."}
        </TooltipContent>
      </Tooltip>
      {hazards.map(([kind, level], i) => {
        const meta = HAZARD_META[kind]
        return (
          <Tooltip key={kind}>
            <TooltipTrigger
              render={
                <span
                  className={pillClass}
                  style={{ animationDelay: `${(i + 1) * 50}ms` }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ background: meta.color }}
                  />
                  {meta.label}
                  <LevelMeter level={level} color={meta.color} />
                </span>
              }
            />
            <TooltipContent side="top">
              {meta.label} exposure · {LEVEL_TEXT[level]} ({level}/3) — regional
              estimate
            </TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
