"use client"

import { useEffect, useState } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { GeoRegion } from "@/lib/geo"

interface Month {
  month: string
  temp: number
  precip: number
}

export function ClimateStrip({
  lat,
  lon,
  region,
}: {
  lat: number
  lon: number
  region: GeoRegion
}) {
  const [months, setMonths] = useState<Month[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/climate?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { months: Month[] }) => {
        if (!cancelled) setMonths(data.months)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [lat, lon])

  const maxTemp = months ? Math.max(...months.map((m) => m.temp), 1) : 1
  const maxPrecip = months ? Math.max(...months.map((m) => m.precip), 1) : 1

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">
          Climate · last 12 months
        </p>
        <p className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-[2px] bg-orange-400" />
            Temp °C
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-[2px] bg-sky-500" />
            Rain mm
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-[2px] bg-amber-500" />
            Season
          </span>
        </p>
      </div>
      <div className="grid grid-cols-12 gap-1">
        {(months ?? Array.from({ length: 12 })).map((month, i) => {
          const inSeason = region.season.includes(i)
          const label = month?.month ?? ""
          const column = (
            <div
              className={`group flex flex-col items-center gap-1 rounded-md px-0.5 py-1 transition-colors ${
                inSeason ? "bg-amber-500/10" : ""
              }`}
            >
              <div className="flex h-14 w-full items-end gap-px">
                <div
                  className={`flex-1 origin-bottom rounded-sm transition-colors ${
                    months ? "motion-safe:animate-bar-grow" : ""
                  } bg-orange-400/60 group-hover:bg-orange-400`}
                  style={{
                    height: months
                      ? `${Math.max(8, (month.temp / maxTemp) * 100)}%`
                      : "8%",
                    opacity: months ? 1 : 0.3,
                    animationDelay: `${i * 25}ms`,
                  }}
                />
                <div
                  className={`w-1 origin-bottom rounded-sm bg-sky-500/60 transition-colors group-hover:bg-sky-500 ${
                    months ? "motion-safe:animate-bar-grow" : ""
                  }`}
                  style={{
                    height: months
                      ? `${Math.max(4, (month.precip / maxPrecip) * 100)}%`
                      : "4%",
                    opacity: months ? 1 : 0.2,
                    animationDelay: `${i * 25 + 12}ms`,
                  }}
                />
              </div>
              <span
                className={`inline-flex items-center gap-0.5 text-[9px] uppercase ${
                  inSeason
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                }`}
              >
                {inSeason && <span className="size-1 rounded-full bg-amber-500" />}
                {label.slice(0, 1)}
              </span>
            </div>
          )
          if (!months) return <div key={i}>{column}</div>
          return (
            <Tooltip key={i}>
              <TooltipTrigger render={column} />
              <TooltipContent
                side="top"
                className="flex-col items-start gap-0.5 px-3 py-2 text-left"
              >
                <span className="font-medium">{label}</span>
                <span className="text-background/70">
                  {month.temp}°C avg · {month.precip} mm rain
                  {inSeason ? ` · ${region.seasonLabel}` : ""}
                </span>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      {failed && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Climate data unavailable.
        </p>
      )}
    </div>
  )
}
