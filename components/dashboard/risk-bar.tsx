"use client"

import { useEffect, useRef } from "react"

export function riskColor(value: number) {
  return `var(--risk-${value < 25 ? "low" : value < 50 ? "medium" : value < 75 ? "high" : "critical"})`
}

export function RiskBar({
  value,
  enter = false,
}: {
  value: number
  enter?: boolean
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
  return (
    <div className="flex min-w-28 items-center gap-3">
      <span className="w-7 shrink-0 tabular-nums">{value}</span>
      <span
        className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
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
      </span>
    </div>
  )
}
