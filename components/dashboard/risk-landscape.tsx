"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import type { Supplier } from "@/lib/supplier-data"

export function RiskLandscape({
  suppliers,
  activeId,
  onSelect,
  onSelectArea,
}: {
  suppliers: Supplier[]
  activeId?: string
  onSelect: (supplier: Supplier) => void
  onSelectArea: (ids: string[]) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const [hovered, setHovered] = useState<Supplier | null>(null)
  const [drag, setDrag] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)
  const draggedRef = useRef(false)
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
    const canvas = overlayRef.current
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
    if (!hovered) return
    const hx = 8 + (hovered.risk / 100) * (width - 16)
    const hy = 8 + ((100 - hovered.delivery) / 45) * (height - 16)
    const guide = style.getPropertyValue("--muted-foreground").trim()
    ctx.globalAlpha = 0.55
    ctx.strokeStyle = guide
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(hx, height - 8)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(8, hy)
    ctx.lineTo(hx, hy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.fillStyle = style.getPropertyValue("--foreground").trim()
    ctx.font = "11px ui-monospace, monospace"
    ctx.textAlign = "center"
    ctx.fillText(`${hovered.risk}`, hx, height - 14)
    ctx.textAlign = "right"
    ctx.fillText(`${hovered.delivery.toFixed(0)}%`, hx - 10, hy + 4)
  }, [suppliers, resolvedTheme, hovered])

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
            ref={overlayRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
          />
          <canvas
            ref={canvasRef}
            className="relative h-full w-full cursor-crosshair touch-manipulation"
            role="img"
            aria-label={`Risk versus delivery rating of ${suppliers.length.toLocaleString("en-GB")} suppliers. Higher delivery and lower risk are preferable. Click a point to inspect it, or drag to select an area.`}
            onPointerDown={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect()
              const x = event.clientX - bounds.left
              const y = event.clientY - bounds.top
              try {
                event.currentTarget.setPointerCapture(event.pointerId)
              } catch {
                // synthetic pointers have no active capture target
              }
              setDrag({ x0: x, y0: y, x1: x, y1: y })
            }}
            onPointerUp={(event) => {
              if (!drag) return
              const bounds = event.currentTarget.getBoundingClientRect()
              const x = event.clientX - bounds.left
              const y = event.clientY - bounds.top
              const x0 = Math.min(drag.x0, x)
              const x1 = Math.max(drag.x0, x)
              const y0 = Math.min(drag.y0, y)
              const y1 = Math.max(drag.y0, y)
              setDrag(null)
              if (x1 - x0 < 6 && y1 - y0 < 6) return
              draggedRef.current = true
              const ids = suppliers
                .filter((s) => {
                  const sx = 8 + (s.risk / 100) * (bounds.width - 16)
                  const sy =
                    8 + ((100 - s.delivery) / 45) * (bounds.height - 16)
                  return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1
                })
                .map((s) => s.id)
              onSelectArea(ids)
            }}
            onClick={(event) => {
              if (draggedRef.current) {
                draggedRef.current = false
                return
              }
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
            onPointerLeave={() => {
              setHovered(null)
              setDrag(null)
            }}
            onPointerMove={(event) => {
              const canvas = event.currentTarget
              const bounds = canvas.getBoundingClientRect()
              const x = event.clientX - bounds.left
              const y = event.clientY - bounds.top
              if (drag) {
                setDrag((d) => (d ? { ...d, x1: x, y1: y } : d))
                return
              }
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
          {drag && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute border border-foreground/60 bg-foreground/10"
              style={{
                left: Math.min(drag.x0, drag.x1),
                top: Math.min(drag.y0, drag.y1),
                width: Math.abs(drag.x1 - drag.x0),
                height: Math.abs(drag.y1 - drag.y0),
              }}
            />
          )}
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
          supplier · click to inspect · drag to select an area
        </span>
      </figcaption>
    </figure>
  )
}
