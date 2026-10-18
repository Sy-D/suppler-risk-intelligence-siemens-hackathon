"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import type { Supplier } from "@/lib/supplier-data"

export function RiskLandscape({
  suppliers,
  activeId,
  onSelect,
}: {
  suppliers: Supplier[]
  activeId?: string
  onSelect: (supplier: Supplier) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const [hovered, setHovered] = useState<Supplier | null>(null)
  const drawRef = useRef<(progress: number) => void>(() => {})
  const progressRef = useRef(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function draw(progress: number) {
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const ratio = Math.min(window.devicePixelRatio, 2)
      canvas.width = width * ratio
      canvas.height = height * ratio
      ctx.scale(ratio, ratio)
      const style = getComputedStyle(canvas)
      const palette = ["low", "medium", "high", "critical"].map((level) =>
        style.getPropertyValue(`--risk-${level}`).trim()
      )
      const baseAlpha =
        suppliers.length > 1000 ? 0.4 : suppliers.length > 100 ? 0.65 : 1
      const radius = suppliers.length <= 20 ? 5 : 2.5
      const sweep = 0.3
      const xOf = (s: Supplier) => 8 + (s.risk / 100) * (width - 16)
      const ease = (t: number) => 1 - Math.pow(1 - t, 3)
      for (const supplier of suppliers) {
        const x = xOf(supplier)
        const local = Math.min(
          Math.max(
            (progress - ((x - 8) / (width - 16)) * sweep) / (1 - sweep),
            0
          ),
          1
        )
        if (local <= 0) continue
        const eased = ease(local)
        const index =
          supplier.risk < 25
            ? 0
            : supplier.risk < 50
              ? 1
              : supplier.risk < 75
                ? 2
                : 3
        ctx.globalAlpha = baseAlpha * eased
        ctx.fillStyle = palette[index]
        ctx.beginPath()
        ctx.arc(
          x,
          8 + ((100 - supplier.delivery) / 45) * (height - 16),
          radius * (0.35 + 0.65 * eased),
          0,
          Math.PI * 2
        )
        ctx.fill()
      }
      const active = suppliers.find((s) => s.id === activeId)
      if (active) {
        const local = ease(
          Math.min(
            Math.max(
              (progress - ((xOf(active) - 8) / (width - 16)) * sweep) /
                (1 - sweep),
              0
            ),
            1
          )
        )
        if (local > 0) {
          ctx.globalAlpha = local
          ctx.strokeStyle = style.getPropertyValue("--foreground").trim()
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(
            xOf(active),
            8 + ((100 - active.delivery) / 45) * (height - 16),
            9,
            0,
            Math.PI * 2
          )
          ctx.stroke()
        }
      }
    }
    drawRef.current = draw
    draw(progressRef.current)
    const observer = new ResizeObserver(() => draw(progressRef.current))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [suppliers, resolvedTheme, activeId])

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      progressRef.current = 1
      drawRef.current(1)
      return
    }
    const duration = 550 + Math.min(suppliers.length, 10000) / 10000 * 300
    progressRef.current = 0
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      progressRef.current = Math.min((now - start) / duration, 1)
      drawRef.current(progressRef.current)
      if (progressRef.current < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [suppliers])

  return (
    <figure>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Delivery rating (%)</span>
        <div className="flex gap-4" aria-label="Risk bands">
          {["Low", "Medium", "High", "Critical"].map((label) => (
            <span key={label} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ background: `var(--risk-${label.toLowerCase()})` }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative flex h-56 gap-3 sm:h-64">
        <div className="flex w-7 shrink-0 flex-col justify-between py-1 text-right text-[11px] text-muted-foreground">
          <span>100</span>
          <span>85</span>
          <span>70</span>
          <span>55</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-2 top-2 bottom-2 flex flex-col justify-between"
          >
            {[0, 1, 2, 3].map((line) => (
              <span key={line} className="w-full border-t border-border/70" />
            ))}
          </div>
          <canvas
            ref={canvasRef}
            className="relative h-full w-full cursor-crosshair touch-manipulation"
            role="img"
            aria-label={`Risk versus delivery rating of ${suppliers.length.toLocaleString("en-GB")} suppliers. Higher delivery and lower risk are preferable.`}
            onClick={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              const x = event.clientX - bounds.left
              const y = event.clientY - bounds.top
              let closest: Supplier | null = null
              let distance = 225
              for (const supplier of suppliers) {
                const dx = 8 + (supplier.risk / 100) * (bounds.width - 16) - x
                const dy =
                  8 +
                  ((100 - supplier.delivery) / 45) * (bounds.height - 16) -
                  y
                if (dx * dx + dy * dy < distance) {
                  closest = supplier
                  distance = dx * dx + dy * dy
                }
              }
              if (closest) onSelect(closest)
            }}
            onPointerLeave={() => setHovered(null)}
            onPointerMove={(event) => {
              const canvas = event.currentTarget
              const bounds = canvas.getBoundingClientRect()
              const x = event.clientX - bounds.left
              const y = event.clientY - bounds.top
              let nearest: Supplier | null = null
              let distance = 100
              for (const supplier of suppliers) {
                const dx = 8 + (supplier.risk / 100) * (bounds.width - 16) - x
                const dy =
                  8 +
                  ((100 - supplier.delivery) / 45) * (bounds.height - 16) -
                  y
                const squared = dx * dx + dy * dy
                if (squared < distance) {
                  nearest = supplier
                  distance = squared
                }
              }
              setHovered(nearest)
            }}
          />
        </div>
        {hovered && (
          <div className="pointer-events-none absolute top-3 right-3 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm">
            <p className="font-medium">{hovered.id}</p>
            <p className="mt-1 text-muted-foreground">
              Risk {hovered.risk} · Delivery {hovered.delivery.toFixed(2)}%
            </p>
          </div>
        )}
      </div>
      <div className="mt-3 ml-10 flex justify-between text-[11px] text-muted-foreground">
        {[0, 25, 50, 75, 100].map((v) => (
          <span key={v}>{v}</span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Lower risk ← Total risk index → Higher risk</span>
        <span>
          {suppliers.length.toLocaleString("en-GB")} suppliers · one dot per
          supplier · click to inspect
        </span>
      </figcaption>
    </figure>
  )
}
