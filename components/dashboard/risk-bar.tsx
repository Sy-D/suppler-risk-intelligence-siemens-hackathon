"use client"

import { useEffect, useRef } from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function riskColor(value: number) {
  return `var(--risk-${value < 25 ? "low" : value < 50 ? "medium" : value < 75 ? "high" : "critical"})`
}

export function riskLevel(value: number) {
  return value < 25
    ? "Low"
    : value < 50
      ? "Medium"
      : value < 75
        ? "High"
        : "Critical"
}

const TICKS = [25, 50, 75]

/** Track + fill only — for compact spots that manage their own value label. */
export function RiskTrack({ value, enter = false }: { value: number; enter?: boolean }) {
  return (
    <span
      className="relative block h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
      aria-hidden="true"
    >
      <span
        data-slot="risk-fill"
        className={`block h-full origin-left rounded-full ${enter ? "motion-safe:animate-risk-fill" : ""}`}
        style={{
          background: riskColor(value),
          transform: `scaleX(${value / 100})`,
        }}
      />
      {TICKS.map((tick) => (
        <span
          key={tick}
          className="absolute inset-y-0 w-px bg-background/70"
          style={{ left: `${tick}%` }}
        />
      ))}
    </span>
  )
}

export function RiskBar({
  value,
  enter = false,
  label,
  description,
}: {
  value: number
  enter?: boolean
  label?: string
  description?: string
}) {
  const bar = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (from === value) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const animation = bar.current?.animate(
      [
        { transform: `scaleX(${from / 100})` },
        { transform: `scaleX(${value / 100})` },
      ],
      { duration: 260, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
    )
    return () => animation?.cancel()
  }, [value])

  const row = (
    <div
      className="flex min-w-28 items-center gap-3"
      tabIndex={description ? 0 : undefined}
      aria-label={
        description
          ? `${label}: ${value} of 100, ${riskLevel(value)} risk`
          : undefined
      }
    >
      <span className="w-7 shrink-0 tabular-nums">{value}</span>
      <span
        className="relative h-2 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
        aria-hidden="true"
      >
        <span
          ref={bar}
          data-slot="risk-fill"
          className={`block h-full origin-left rounded-full ${enter ? "motion-safe:animate-risk-fill" : ""}`}
          style={{
            background: riskColor(value),
            transform: `scaleX(${value / 100})`,
          }}
        />
        {TICKS.map((tick) => (
          <span
            key={tick}
            className="absolute inset-y-0 w-px bg-background/70"
            style={{ left: `${tick}%` }}
          />
        ))}
      </span>
    </div>
  )

  if (!description) return row
  return (
    <Tooltip>
      <TooltipTrigger render={row} />
      <TooltipContent
        side="top"
        className="max-w-60 flex-col items-start gap-0.5 px-3 py-2 text-left"
      >
        <span className="font-medium">
          {label} · {value}/100 · {riskLevel(value)}
        </span>
        <span className="text-background/70">{description}</span>
      </TooltipContent>
    </Tooltip>
  )
}
