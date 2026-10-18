"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { euro, riskDimensions } from "@/lib/risk"
import type { Supplier } from "@/lib/supplier-data"

type LandscapeProps = {
  suppliers: Supplier[]
  activeId?: string
  onSelect: (supplier: Supplier) => void
  onSelectArea: (ids: string[]) => void
}

const VIEWS = [
  { id: "classic", label: "Classic" },
  { id: "quadrant", label: "Quadrants" },
  { id: "density", label: "Density" },
  { id: "split", label: "Focus panel" },
  { id: "refined", label: "Refined" },
] as const

type View = (typeof VIEWS)[number]["id"]
type Mode = Exclude<View, "classic">

export function RiskLandscape(props: LandscapeProps) {
  const [view, setView] = useState<View>("classic")
  return (
    <div className="space-y-4">
      <ButtonGroup aria-label="Chart view" className="flex-wrap">
        {VIEWS.map((v) => (
          <Button
            key={v.id}
            size="xs"
            variant={view === v.id ? "secondary" : "outline"}
            aria-pressed={view === v.id}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </Button>
        ))}
      </ButtonGroup>
      {view === "classic" ? (
        <ClassicLandscape {...props} />
      ) : (
        <EnhancedLandscape key={view} mode={view} {...props} />
      )}
    </div>
  )
}

const LEVELS = ["Low", "Medium", "High", "Critical"] as const
const RISK_THRESHOLD = 50
const DELIVERY_TARGET = 85

const bandIndex = (risk: number) =>
  risk < 25 ? 0 : risk < 50 ? 1 : risk < 75 ? 2 : 3

const spendScale = (exposure: number) =>
  Math.min(
    Math.max(
      (Math.log10(Math.max(exposure, 1)) - 4) / (Math.log10(5e7) - 4),
      0
    ),
    1
  )

const isActNow = (s: Supplier) =>
  s.risk >= RISK_THRESHOLD && s.delivery < DELIVERY_TARGET

type Domain = { xMin: number; xMax: number; yMin: number; yMax: number }

function fitDomain(suppliers: Supplier[]): Domain {
  if (!suppliers.length) return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 }
  let rLo = 100
  let rHi = 0
  let dLo = 100
  let dHi = 0
  for (const s of suppliers) {
    rLo = Math.min(rLo, s.risk)
    rHi = Math.max(rHi, s.risk)
    dLo = Math.min(dLo, s.delivery)
    dHi = Math.max(dHi, s.delivery)
  }
  const fit = (lo: number, hi: number, span = 10) => {
    let a = Math.floor(lo)
    let b = Math.ceil(hi)
    if (b - a < span) {
      a = Math.max(Math.floor((a + b - span) / 2), 0)
      b = Math.min(a + span, 100)
      a = b - span
    }
    return [a, b]
  }
  const [xMin, xMax] = fit(rLo, rHi)
  const [yMin, yMax] = fit(dLo, dHi)
  return { xMin, xMax, yMin, yMax }
}

function ticks(min: number, max: number) {
  const span = max - min
  const step = span > 40 ? 10 : span > 15 ? 5 : span > 6 ? 2 : 1
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v)
  return out
}

function geometry(width: number, height: number, mode: Mode, d: Domain) {
  const left = 58
  const right = 14
  const top = 14
  const bottom = mode === "density" ? 76 : mode === "split" ? 36 : 28
  const pad = 6
  const pw = Math.max(width - left - right, 1)
  const ph = Math.max(height - top - bottom, 1)
  return {
    width,
    height,
    left,
    top,
    pw,
    ph,
    ...d,
    x: (risk: number) =>
      left + pad + ((risk - d.xMin) / (d.xMax - d.xMin)) * (pw - 2 * pad),
    y: (delivery: number) =>
      top +
      pad +
      ((d.yMax - Math.min(Math.max(delivery, d.yMin), d.yMax)) /
        (d.yMax - d.yMin)) *
        (ph - 2 * pad),
  }
}

type Geometry = ReturnType<typeof geometry>

function prepare(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = Math.min(window.devicePixelRatio, 2)
  canvas.width = width * ratio
  canvas.height = height * ratio
  const ctx = canvas.getContext("2d")
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0)
  return ctx
}

function themeColors(canvas: HTMLCanvasElement) {
  const style = getComputedStyle(canvas)
  const css = (name: string) => style.getPropertyValue(name).trim()
  return {
    palette: LEVELS.map((l) => css(`--risk-${l.toLowerCase()}`)),
    fg: css("--foreground"),
    muted: css("--muted-foreground"),
    border: css("--border"),
    card: css("--card") || css("--background"),
    accent: css("--chart-3"),
  }
}

type Colors = ReturnType<typeof themeColors>

const FONT = "11px ui-sans-serif, system-ui, sans-serif"

function paint(
  ctx: CanvasRenderingContext2D,
  g: Geometry,
  mode: Mode,
  ordered: Supplier[],
  c: Colors,
  t: number
) {
  const e = 1 - Math.pow(1 - t, 3)
  const x0 = g.left
  const x1 = g.left + g.pw
  const y0 = g.top
  const y1 = g.top + g.ph
  const line = (ax: number, ay: number, bx: number, by: number) => {
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.stroke()
  }
  const clipped = (y: number, h: number, fn: () => void) => {
    ctx.save()
    ctx.beginPath()
    ctx.rect(x0, y, g.pw, h)
    ctx.clip()
    fn()
    ctx.restore()
  }
  const bands = (y: number, h: number, alpha: number) =>
    clipped(y, h, () =>
      c.palette.forEach((color, i) => {
        ctx.globalAlpha = alpha
        ctx.fillStyle = color
        ctx.fillRect(g.x(i * 25), y, g.x((i + 1) * 25) - g.x(i * 25) - 1, h)
      })
    )
  ctx.clearRect(0, 0, g.width, g.height)

  if (mode === "refined") bands(y0, g.ph, 0.08)
  const qx = Math.min(Math.max(g.x(RISK_THRESHOLD), x0), x1)
  const qy = Math.min(Math.max(g.y(DELIVERY_TARGET), y0), y1)
  if (mode === "quadrant") {
    ctx.globalAlpha = 0.08
    ctx.fillStyle = c.palette[0]
    ctx.fillRect(x0, y0, qx - x0, qy - y0)
    ctx.globalAlpha = 0.11
    ctx.fillStyle = c.palette[3]
    ctx.fillRect(qx, qy, x1 - qx, y1 - qy)
  }

  ctx.font = FONT
  ctx.lineWidth = 1
  ctx.strokeStyle = c.border
  ctx.fillStyle = c.muted
  ctx.textAlign = "right"
  ctx.textBaseline = "middle"
  for (const v of ticks(g.yMin, g.yMax)) {
    const y = Math.round(g.y(v)) + 0.5
    ctx.globalAlpha = 1
    line(x0, y, x1, y)
    ctx.fillText(`${v}%`, x0 - 8, y)
  }
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  const labelY = mode === "split" ? y1 + 16 : y1 + 8
  for (const v of ticks(g.xMin, g.xMax)) {
    const x = Math.round(g.x(v)) + 0.5
    ctx.globalAlpha = 0.5
    line(x, y0, x, y1)
    ctx.globalAlpha = 1
    ctx.fillText(String(v), x, labelY)
  }
  ctx.save()
  ctx.translate(12, y0 + g.ph / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textBaseline = "middle"
  ctx.fillText("Delivery rating", 0, 0)
  ctx.restore()

  if (mode === "split") bands(y1 + 6, 4, 1)

  const n = ordered.length
  if (mode === "density") {
    const cell = 8
    const cols = Math.ceil(g.pw / cell)
    const rows = Math.ceil(g.ph / cell)
    const counts = new Uint16Array(cols * rows)
    const cellOf = (s: Supplier) =>
      Math.min(Math.floor((g.y(s.delivery) - y0) / cell), rows - 1) * cols +
      Math.min(Math.floor((g.x(s.risk) - x0) / cell), cols - 1)
    for (const s of ordered) counts[cellOf(s)]++
    const max = Math.max(...counts, 3)
    ctx.fillStyle = c.accent
    counts.forEach((count, i) => {
      if (count < 3) return
      ctx.globalAlpha = (0.15 + 0.85 * (Math.log(count) / Math.log(max))) * e
      ctx.fillRect(
        x0 + (i % cols) * cell,
        y0 + Math.floor(i / cols) * cell,
        cell - 1,
        cell - 1
      )
    })
    for (const s of ordered) {
      if (counts[cellOf(s)] >= 3) continue
      ctx.globalAlpha = e
      ctx.fillStyle = c.palette[bandIndex(s.risk)]
      ctx.beginPath()
      ctx.arc(g.x(s.risk), g.y(s.delivery), 2.75, 0, Math.PI * 2)
      ctx.fill()
    }
    const b0 = Math.floor(g.xMin / 5) * 5
    const bins = Array.from(
      { length: Math.max(Math.ceil((g.xMax - b0) / 5), 1) },
      () => 0
    )
    for (const s of ordered)
      bins[Math.min(Math.floor((s.risk - b0) / 5), bins.length - 1)]++
    const binMax = Math.max(...bins, 1)
    const hTop = y1 + 26
    const hH = g.height - hTop - 4
    clipped(hTop, hH, () =>
      bins.forEach((b, i) => {
        const from = b0 + i * 5
        const bh = (b / binMax) * hH * e
        ctx.globalAlpha = 0.85
        ctx.fillStyle = c.palette[bandIndex(from)]
        ctx.fillRect(
          g.x(from) + 1,
          hTop + hH - bh,
          g.x(from + 5) - g.x(from) - 2,
          bh
        )
      })
    )
  } else {
    const base = n <= 20 ? 6 : n <= 200 ? 4.5 : n <= 2000 ? 3 : 2.2
    const alpha = n > 2000 ? 0.55 : n > 200 ? 0.75 : 0.9
    for (const s of ordered) {
      const r = base * (0.55 + 1.3 * spendScale(s.exposure)) * (0.35 + 0.65 * e)
      ctx.beginPath()
      ctx.arc(g.x(s.risk), g.y(s.delivery), r, 0, Math.PI * 2)
      ctx.globalAlpha = alpha * e
      ctx.fillStyle =
        mode === "refined"
          ? c.accent
          : c.palette[Math.max(LEVELS.indexOf(s.sourcing), 0)]
      ctx.fill()
      if (n <= 2000) {
        ctx.globalAlpha = 0.9 * e
        ctx.strokeStyle = c.card
        ctx.lineWidth = 0.75
        ctx.stroke()
      }
    }
  }

  if (mode === "quadrant") {
    ctx.globalAlpha = 0.8
    ctx.strokeStyle = c.muted
    ctx.setLineDash([4, 4])
    line(qx, y0, qx, y1)
    line(x0, qy, x1, qy)
    ctx.setLineDash([])
    const counts = { strategic: 0, watch: 0, under: 0, act: 0 }
    for (const s of ordered) {
      const good = s.delivery >= DELIVERY_TARGET
      if (s.risk < RISK_THRESHOLD) counts[good ? "strategic" : "under"]++
      else counts[good ? "watch" : "act"]++
    }
    ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif"
    const zones = [
      ["STRATEGIC PARTNERS", counts.strategic, x0 + 8, y0 + 6, "left", "top"],
      ["WATCH LIST", counts.watch, x1 - 8, y0 + 6, "right", "top"],
      ["UNDERPERFORMERS", counts.under, x0 + 8, y1 - 6, "left", "bottom"],
      ["ACT NOW", counts.act, x1 - 8, y1 - 6, "right", "bottom"],
    ] as const
    for (const [label, count, x, y, align, baseline] of zones) {
      ctx.globalAlpha = 1
      ctx.fillStyle = label === "ACT NOW" ? c.palette[3] : c.muted
      ctx.textAlign = align
      ctx.textBaseline = baseline
      ctx.fillText(`${label} · ${count.toLocaleString("en-GB")}`, x, y)
    }
    ctx.font = FONT
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    const urgent = ordered.filter(isActNow).slice(0, 4)
    for (const s of urgent) {
      const name = s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name
      const x = Math.min(g.x(s.risk) + 8, x1 - ctx.measureText(name).width - 6)
      const y = g.y(s.delivery)
      const w = ctx.measureText(name).width + 8
      ctx.globalAlpha = 0.85 * e
      ctx.fillStyle = c.card
      ctx.fillRect(x - 4, y - 8, w, 16)
      ctx.globalAlpha = e
      ctx.fillStyle = c.fg
      ctx.fillText(name, x, y)
    }
  }
  ctx.globalAlpha = 1
}

function EnhancedLandscape({
  mode,
  suppliers,
  activeId,
  onSelect,
  onSelectArea,
}: LandscapeProps & { mode: Mode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const { resolvedTheme } = useTheme()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hovered, setHovered] = useState<Supplier | null>(null)
  const [drag, setDrag] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)
  const draggedRef = useRef(false)
  const animatedRef = useRef<Supplier[] | null>(null)

  const domain = useMemo(() => fitDomain(suppliers), [suppliers])
  const ordered = useMemo(
    () => [...suppliers].sort((a, b) => b.exposure - a.exposure),
    [suppliers]
  )
  const active = useMemo(
    () => suppliers.find((s) => s.id === activeId),
    [suppliers, activeId]
  )
  const summary = useMemo(() => {
    let spend = 0
    let risk = 0
    let delivery = 0
    let act = 0
    for (const s of suppliers) {
      spend += s.exposure
      risk += s.risk
      delivery += s.delivery
      if (isActNow(s)) act++
    }
    const n = suppliers.length || 1
    return { spend, risk: risk / n, delivery: delivery / n, act }
  }, [suppliers])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    )
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.width) return
    const ctx = prepare(canvas, size.width, size.height)
    if (!ctx) return
    const g = geometry(size.width, size.height, mode, domain)
    const colors = themeColors(canvas)
    const draw = (t: number) => paint(ctx, g, mode, ordered, colors, t)
    if (
      animatedRef.current === ordered ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      animatedRef.current = ordered
      draw(1)
      return
    }
    animatedRef.current = ordered
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min((now - start) / 600, 1)
      draw(t)
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
      draw(1)
    }
  }, [ordered, size, mode, domain, resolvedTheme])

  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || !size.width) return
    const ctx = prepare(canvas, size.width, size.height)
    if (!ctx) return
    const g = geometry(size.width, size.height, mode, domain)
    const c = themeColors(canvas)
    if (active) {
      ctx.strokeStyle = c.fg
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(g.x(active.risk), g.y(active.delivery), 9, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (!hovered) return
    const hx = g.x(hovered.risk)
    const hy = g.y(hovered.delivery)
    const y1 = g.top + g.ph
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = c.muted
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(hx, hy)
    ctx.lineTo(hx, y1)
    ctx.moveTo(g.left, hy)
    ctx.lineTo(hx, hy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.globalAlpha = 1
    ctx.strokeStyle = c.fg
    ctx.beginPath()
    ctx.arc(hx, hy, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.font = FONT
    ctx.textBaseline = "middle"
    const pill = (
      text: string,
      x: number,
      y: number,
      align: "center" | "right"
    ) => {
      const w = ctx.measureText(text).width + 10
      const left = align === "center" ? x - w / 2 : x - w
      ctx.fillStyle = c.fg
      ctx.fillRect(left, y - 8, w, 16)
      ctx.fillStyle = c.card
      ctx.textAlign = "center"
      ctx.fillText(text, left + w / 2, y)
    }
    pill(
      String(hovered.risk),
      hx,
      mode === "split" ? y1 + 22 : y1 + 14,
      "center"
    )
    pill(`${hovered.delivery.toFixed(1)}%`, g.left - 4, hy, "right")
  }, [hovered, active, size, mode, domain, resolvedTheme])

  function pick(x: number, y: number, bounds: DOMRect, maxSquared: number) {
    const g = geometry(bounds.width, bounds.height, mode, domain)
    let nearest: Supplier | null = null
    let distance = maxSquared
    for (const s of suppliers) {
      const dx = g.x(s.risk) - x
      const dy = g.y(s.delivery) - y
      const squared = dx * dx + dy * dy
      if (squared < distance) {
        nearest = s
        distance = squared
      }
    }
    return nearest
  }

  const focus = hovered ?? active ?? null
  const g = geometry(size.width, size.height, mode, domain)
  const tooltip =
    hovered && mode !== "split"
      ? { x: g.x(hovered.risk), y: g.y(hovered.delivery) }
      : null

  const chips = (label: string) => (
    <div className="flex flex-wrap items-center gap-3">
      <span>{label}</span>
      {LEVELS.map((level) => (
        <span key={level} className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full"
            style={{ background: `var(--risk-${level.toLowerCase()})` }}
          />
          {level}
        </span>
      ))}
    </div>
  )
  const sizeLegend = (
    <span className="flex items-center gap-1.5">
      <span className="size-1.5 rounded-full bg-muted-foreground/60" />
      €10k
      <span className="ml-1 size-3 rounded-full bg-muted-foreground/60" />
      €50m spend
    </span>
  )

  const chart = (
    <div className="relative h-72 min-w-0 sm:h-80">
      <canvas
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
      />
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-crosshair touch-manipulation"
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
          const geo = geometry(bounds.width, bounds.height, mode, domain)
          onSelectArea(
            suppliers
              .filter((s) => {
                const sx = geo.x(s.risk)
                const sy = geo.y(s.delivery)
                return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1
              })
              .map((s) => s.id)
          )
        }}
        onClick={(event) => {
          if (draggedRef.current) {
            draggedRef.current = false
            return
          }
          const bounds = event.currentTarget.getBoundingClientRect()
          const closest = pick(
            event.clientX - bounds.left,
            event.clientY - bounds.top,
            bounds,
            225
          )
          if (closest) onSelect(closest)
        }}
        onPointerLeave={() => {
          setHovered(null)
          setDrag(null)
        }}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect()
          const x = event.clientX - bounds.left
          const y = event.clientY - bounds.top
          if (drag) {
            setDrag((d) => (d ? { ...d, x1: x, y1: y } : d))
            return
          }
          setHovered(pick(x, y, bounds, 100))
        }}
      />
      {drag && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-20 border border-foreground/60 bg-foreground/10"
          style={{
            left: Math.min(drag.x0, drag.x1),
            top: Math.min(drag.y0, drag.y1),
            width: Math.abs(drag.x1 - drag.x0),
            height: Math.abs(drag.y1 - drag.y0),
          }}
        />
      )}
      {tooltip && hovered && (
        <div
          className="pointer-events-none absolute z-20 w-max max-w-56 rounded-xl border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-sm"
          style={{
            top: Math.min(Math.max(tooltip.y - 24, 4), size.height - 96),
            ...(tooltip.x < size.width / 2
              ? { left: tooltip.x + 14 }
              : { right: size.width - tooltip.x + 14 }),
          }}
        >
          <p className="truncate font-medium">{hovered.name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {hovered.id}
          </p>
          <p className="mt-1 text-muted-foreground">
            Risk {hovered.risk} · Delivery {hovered.delivery.toFixed(2)}%
          </p>
          <p className="text-muted-foreground">
            {euro.format(hovered.exposure)} · {hovered.sourcing} sourcing risk
          </p>
        </div>
      )}
    </div>
  )

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        {mode === "quadrant" && (
          <>
            {chips("Sourcing risk")}
            {sizeLegend}
          </>
        )}
        {mode === "density" && (
          <>
            <span className="flex items-center gap-2">
              Suppliers per cell
              <span
                className="h-2 w-20 rounded-full"
                style={{
                  background:
                    "linear-gradient(to right, color-mix(in oklch, var(--chart-3) 15%, transparent), var(--chart-3))",
                }}
              />
            </span>
            {chips("Outliers by risk band")}
          </>
        )}
        {mode === "split" && (
          <>
            {chips("Sourcing risk")}
            {sizeLegend}
          </>
        )}
        {mode === "refined" && (
          <>
            {chips("Risk bands")}
            {sizeLegend}
          </>
        )}
      </div>
      {mode === "split" ? (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
          {chart}
          <aside className="rounded-xl border bg-muted/30 p-3 text-xs">
            {focus ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{focus.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {focus.id} · {focus.region}
                  </p>
                </div>
                {[
                  ["Risk", focus.risk, `${focus.risk}`],
                  ["Delivery", focus.delivery, `${focus.delivery.toFixed(1)}%`],
                ].map(([label, value, text]) => (
                  <div key={label}>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{label}</span>
                      <span className="text-foreground tabular-nums">
                        {text}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${value}%`,
                          background:
                            label === "Risk"
                              ? `var(--risk-${LEVELS[bandIndex(focus.risk)].toLowerCase()})`
                              : "var(--chart-3)",
                        }}
                      />
                    </div>
                  </div>
                ))}
                <p className="flex justify-between text-muted-foreground">
                  Spend
                  <span className="text-foreground">
                    {euro.format(focus.exposure)}
                  </span>
                </p>
                <div>
                  <p className="mb-1.5 text-muted-foreground">Top drivers</p>
                  {riskDimensions
                    .map((d) => ({ label: d.label, value: focus[d.key] }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 3)
                    .map((d) => (
                      <div
                        key={d.label}
                        className="flex items-center justify-between gap-2 py-0.5"
                      >
                        <span className="truncate">
                          {d.label.replace(/ risk$/, "")}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {d.value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {suppliers.length.toLocaleString("en-GB")} suppliers
                </p>
                {[
                  ["Total spend", euro.format(summary.spend)],
                  ["Avg. risk", summary.risk.toFixed(1)],
                  ["Avg. delivery", `${summary.delivery.toFixed(1)}%`],
                  [
                    `Risk ≥ ${RISK_THRESHOLD}, delivery < ${DELIVERY_TARGET}%`,
                    summary.act.toLocaleString("en-GB"),
                  ],
                ].map(([label, value]) => (
                  <p
                    key={label}
                    className="flex justify-between gap-2 text-muted-foreground"
                  >
                    {label}
                    <span className="text-foreground tabular-nums">
                      {value}
                    </span>
                  </p>
                ))}
                <p className="pt-2 text-muted-foreground">
                  Hover a point for details, click to pin it.
                </p>
              </div>
            )}
          </aside>
        </div>
      ) : (
        chart
      )}
      <figcaption className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>Lower risk ← Total risk index → Higher risk</span>
        <span>
          {mode === "quadrant"
            ? `Split at risk ${RISK_THRESHOLD} and ${DELIVERY_TARGET}% delivery · top spend in “Act now” labelled`
            : mode === "density"
              ? "Dense areas binned · sparse outliers drawn as dots · histogram shows risk spread"
              : `${suppliers.length.toLocaleString("en-GB")} suppliers · dot size = spend`}{" "}
          · drag to select
        </span>
      </figcaption>
    </figure>
  )
}

function ClassicLandscape({
  suppliers,
  activeId,
  onSelect,
  onSelectArea,
}: LandscapeProps) {
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
    const duration = 550 + (Math.min(suppliers.length, 10000) / 10000) * 300
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
