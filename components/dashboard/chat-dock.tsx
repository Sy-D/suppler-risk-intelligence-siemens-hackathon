"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { BorderBeam } from "border-beam"
import {
  ArrowUp,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BlockList } from "@/components/analyst/answer-blocks"
import { SupplierChipsBlock } from "@/components/analyst/blocks"
import { useAnalystChat } from "@/components/analyst/use-analyst-chat"
import { MarkdownAnswer } from "@/components/dashboard/markdown-answer"
import { ActivityLog } from "@/components/dashboard/workspace-panels"
import type { Supplier } from "@/lib/supplier-data"

const mentionPattern = /SUPP_\d{5}/g

function mentionedIds(text: string) {
  return [...new Set(text.match(mentionPattern))].slice(0, 20)
}

export function ChatDock({
  open,
  seed,
  suppliers,
  selected,
  onClose,
  onOpenProfile,
}: {
  open: boolean
  seed: string
  suppliers: Supplier[]
  selected: Supplier[]
  onClose: () => void
  onOpenProfile: (supplier: Supplier) => void
}) {
  if (!open) return null
  return (
    <Dock
      seed={seed}
      suppliers={suppliers}
      selected={selected}
      onClose={onClose}
      onOpenProfile={onOpenProfile}
    />
  )
}

function Dock({
  seed,
  suppliers,
  onClose,
  onOpenProfile,
}: Omit<React.ComponentProps<typeof ChatDock>, "open">) {
  const { turns, pending, activity, loading, ask, clear } = useAnalystChat()
  const [draft, setDraft] = useState("")
  const [full, setFull] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const hasMessages = turns.length > 0 || loading

  const seeded = useRef(false)
  useEffect(() => {
    if (!seeded.current && seed) {
      seeded.current = true
      ask(seed)
    }
    inputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    })
  }, [turns, pending, activity])

  useEffect(() => {
    function onType(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "Escape") {
        onClose()
        return
      }
      if (event.key.length !== 1) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        target.closest(
          "input, textarea, select, [contenteditable=true], [role=dialog]"
        )
      )
        return
      event.preventDefault()
      setDraft((d) => d + event.key)
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", onType)
    return () => document.removeEventListener("keydown", onType)
  }, [onClose])

  return (
    <div
      className={`pointer-events-none fixed z-40 flex justify-center ${
        full ? "inset-4" : "inset-x-0 bottom-4 px-4"
      }`}
    >
      <div
        role="dialog"
        aria-label="Ask your analyst"
        className={`pointer-events-auto flex w-full flex-col overflow-hidden rounded-2xl border bg-popover shadow-xl motion-safe:animate-dock-in ${
          full ? "max-w-4xl" : "max-w-2xl"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <p className="flex items-center gap-2 text-xs font-medium">
            <Sparkles className="size-3.5" />
            Ask your analyst
          </p>
          <div className="flex items-center gap-1">
            {turns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => {
                  clear()
                  setDraft("")
                  inputRef.current?.focus()
                }}
              >
                <Trash2 data-icon="inline-start" />
                Clear chat
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={full ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => setFull((f) => !f)}
            >
              {full ? <Minimize2 /> : <Maximize2 />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close analyst chat"
              onClick={onClose}
            >
              <X />
            </Button>
          </div>
        </div>
        {hasMessages && (
          <div
            ref={scrollRef}
            className={`space-y-3 overflow-y-auto px-4 py-3 ${
              full ? "flex-1" : "max-h-[42svh]"
            }`}
          >
            {turns.map((turn, i) => {
              const ids = turn.failed ? [] : mentionedIds(turn.answer)
              return (
                <div key={i} className="space-y-3">
                  <p className="ml-auto w-fit max-w-[85%] rounded-xl bg-muted px-3 py-2 text-sm motion-safe:animate-detail-in">
                    {turn.question}
                  </p>
                  {turn.failed ? (
                    <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm whitespace-pre-line text-destructive motion-safe:animate-detail-in">
                      {turn.answer}
                    </p>
                  ) : (
                    <div className="space-y-3 rounded-xl bg-secondary/60 px-3 py-2.5 text-sm leading-relaxed motion-safe:animate-detail-in">
                      <MarkdownAnswer>{turn.answer}</MarkdownAnswer>
                      {turn.blocks?.length ? (
                        <BlockList
                          blocks={turn.blocks}
                          suppliers={suppliers}
                          onOpenProfile={onOpenProfile}
                        />
                      ) : ids.length > 0 && (
                        <SupplierChipsBlock
                          block={{ type: "supplier_chips", supplierIds: ids }}
                          suppliers={suppliers}
                          onOpenProfile={onOpenProfile}
                        />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {loading && (
              <div className="space-y-3">
                <p className="ml-auto w-fit max-w-[85%] rounded-xl bg-muted px-3 py-2 text-sm">
                  {pending}
                </p>
                <div
                  className="rounded-xl bg-secondary/60 px-3 py-2.5 text-sm"
                  role="status"
                >
                  <p className="flex items-center gap-2">
                    <LoaderCircle className="size-4 shrink-0 animate-spin" />
                    Querying the dataset…
                  </p>
                  <ActivityLog lines={activity} />
                </div>
              </div>
            )}
          </div>
        )}
        <form
          className="flex items-center gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault()
            const question = draft.trim()
            if (!question || loading) return
            setDraft("")
            ask(question)
          }}
        >
          <BorderBeam
            size="md"
            theme={resolvedTheme === "light" ? "light" : "dark"}
            borderRadius={999}
            strength={0.85}
            className="min-w-0 flex-1"
          >
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                turns.length
                  ? "Ask a follow-up…"
                  : "Ask about suppliers, risks or a supplier ID…"
              }
              aria-label="Ask the analyst"
              className="h-10 w-full text-base md:text-sm"
            />
          </BorderBeam>
          <Button
            type="submit"
            size="icon-lg"
            className="size-10"
            aria-label="Send question"
            disabled={!draft.trim() || loading}
          >
            <ArrowUp />
          </Button>
        </form>
      </div>
    </div>
  )
}
