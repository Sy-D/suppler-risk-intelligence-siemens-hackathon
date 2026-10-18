"use client"

import { useEffect, useState } from "react"
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
        <p className="text-xs text-muted-foreground">{region.seasonLabel}</p>
      </div>
      <div className="grid grid-cols-12 gap-1.5">
        {(months ?? Array.from({ length: 12 })).map((month, i) => {
          const inSeason = region.season.includes(i)
          const label = month?.month ?? ""
          return (
            <div
              key={i}
              className="group flex flex-col items-center gap-1"
              title={
                months
                  ? `${label}: ${month.temp}°C avg, ${month.precip} mm rain${inSeason ? ` · ${region.seasonLabel}` : ""}`
                  : label
              }
            >
              <div className="flex h-14 w-full items-end gap-px">
                <div
                  className={`flex-1 rounded-sm transition-colors ${
                    inSeason
                      ? "bg-amber-500/70 group-hover:bg-amber-500"
                      : "bg-sky-500/50 group-hover:bg-sky-500"
                  }`}
                  style={{
                    height: months
                      ? `${Math.max(8, (month.temp / maxTemp) * 100)}%`
                      : "8%",
                    opacity: months ? 1 : 0.3,
                  }}
                />
                <div
                  className="w-1 rounded-sm bg-blue-400/60"
                  style={{
                    height: months
                      ? `${Math.max(4, (month.precip / maxPrecip) * 100)}%`
                      : "4%",
                    opacity: months ? 1 : 0.2,
                  }}
                />
              </div>
              <span
                className={`text-[9px] uppercase ${
                  inSeason ? "font-medium text-amber-500" : "text-muted-foreground"
                }`}
              >
                {label.slice(0, 1)}
              </span>
            </div>
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
