"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { BorderBeam } from "border-beam"
import { CornerDownLeft, Search, Sparkles } from "lucide-react"
import { AnimatedNumber, deliveryFormat } from "./animated-number"
import { RiskBadge } from "./risk-badge"
import type { Supplier } from "@/lib/supplier-data"

export function CommandSearch({
  open,
  seed,
  suppliers,
  onPick,
  onAsk,
  onClose,
}: {
  open: boolean
  seed: string
  suppliers: Supplier[]
  onPick: (supplier: Supplier) => void
  onAsk: (query: string) => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <Overlay
      seed={seed}
      suppliers={suppliers}
      onPick={onPick}
      onAsk={onAsk}
      onClose={onClose}
    />
  )
}

function Overlay({
  seed,
  suppliers,
  onPick,
  onAsk,
  onClose,
}: Omit<React.ComponentProps<typeof CommandSearch>, "open">) {
  const [query, setQuery] = useState(seed)
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const trimmed = query.trim()
  const { resolvedTheme } = useTheme()

  const results = useMemo(() => {
    const q = trimmed.toLowerCase()
    if (!q) return []
    return suppliers
      .filter((s) => `${s.id} ${s.name}`.toLowerCase().includes(q))
      .slice(0, 7)
  }, [suppliers, trimmed])

  const itemCount = results.length + (trimmed ? 1 : 0)
  const activeIndex = Math.min(active, Math.max(itemCount - 1, 0))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  function choose(index: number) {
    if (index < results.length) onPick(results[index])
    else if (trimmed) onAsk(trimmed)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick search"
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[18svh]"
    >
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] motion-safe:animate-backdrop-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border bg-popover shadow-xl motion-safe:animate-overlay-in">
        <div className="border-b p-3">
          <BorderBeam
            size="md"
            theme={resolvedTheme === "light" ? "light" : "dark"}
            borderRadius={12}
            strength={0.85}
          >
            <div className="flex h-12 items-center gap-3 rounded-xl border bg-background px-3.5">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault()
                    setActive((a) => Math.min(a + 1, itemCount - 1))
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault()
                    setActive((a) => Math.max(a - 1, 0))
                  } else if (event.key === "Enter") {
                    event.preventDefault()
                    if (event.metaKey || event.ctrlKey) {
                      if (trimmed) onAsk(trimmed)
                    } else if (itemCount > 0) {
                      choose(activeIndex)
                    } else if (trimmed) {
                      onAsk(trimmed)
                    }
                  }
                }}
                placeholder="Search suppliers, or ask your analyst…"
                aria-label="Search suppliers or ask a question"
                className="h-full w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
              />
              <kbd className="hidden shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">
                esc
              </kbd>
            </div>
          </BorderBeam>
        </div>
        <div ref={listRef} className="max-h-72 overflow-y-auto p-2">
          {results.map((supplier, i) => (
            <button
              key={supplier.id}
              type="button"
              data-index={i}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(supplier)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${
                activeIndex === i ? "bg-muted" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{supplier.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {supplier.id}
                </p>
              </div>
              <span className="hidden text-xs text-muted-foreground tabular-nums sm:block">
                <AnimatedNumber
                  value={supplier.delivery}
                  format={deliveryFormat}
                  suffix="%"
                />
              </span>
              <RiskBadge level={supplier.level} />
            </button>
          ))}
          {trimmed && (
            <button
              type="button"
              data-index={results.length}
              onMouseEnter={() => setActive(results.length)}
              onClick={() => onAsk(trimmed)}
              className={`mt-1 flex w-full items-center gap-3 rounded-xl border-t px-3 py-2.5 text-left text-sm ${
                activeIndex === results.length ? "bg-muted" : ""
              }`}
            >
              <Sparkles className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">
                Ask your analyst: {trimmed}
              </span>
              <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          )}
          {trimmed && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No suppliers match — press Enter to ask the analyst instead.
            </p>
          )}
          {!trimmed && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              Type a name, an ID like SUPP_00018, or a question.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
