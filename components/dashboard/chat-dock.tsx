"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import { BorderBeam } from "border-beam"
import { ArrowUp, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnswerBlocks } from "@/components/analyst/answer-blocks"
import { composeAnswer } from "@/lib/analyst/compose"
import type { AnalystAnswer } from "@/lib/analyst/schema"
import type { Supplier } from "@/lib/supplier-data"

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; answer: AnalystAnswer }

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
  selected,
  onClose,
  onOpenProfile,
}: Omit<React.ComponentProps<typeof ChatDock>, "open">) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()

  function ask(question: string) {
    setMessages((m) => [
      ...m,
      { role: "user", text: question },
      { role: "assistant", answer: composeAnswer(question, suppliers, selected) },
    ])
  }

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
  }, [messages])

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
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div
        role="dialog"
        aria-label="Ask your analyst"
        className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-2xl border bg-popover shadow-xl motion-safe:animate-dock-in"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <p className="flex items-center gap-2 text-xs font-medium">
            <Sparkles className="size-3.5" />
            Ask your analyst
          </p>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close analyst chat"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="max-h-[42svh] space-y-3 overflow-y-auto px-4 py-3"
          >
            {messages.map((message, i) =>
              message.role === "user" ? (
                <p
                  key={i}
                  className="ml-auto w-fit max-w-[85%] rounded-xl bg-muted px-3 py-2 text-sm motion-safe:animate-detail-in"
                >
                  {message.text}
                </p>
              ) : (
                <div
                  key={i}
                  className="rounded-xl bg-secondary/60 px-3 py-2.5 motion-safe:animate-detail-in"
                >
                  <AnswerBlocks
                    answer={message.answer}
                    suppliers={suppliers}
                    onOpenProfile={onOpenProfile}
                  />
                </div>
              )
            )}
          </div>
        )}
        <form
          className="flex items-center gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault()
            const question = draft.trim()
            if (!question) return
            setDraft("")
            ask(question)
          }}
        >
          <BorderBeam
            size="md"
            theme={resolvedTheme === "light" ? "light" : "dark"}
            borderRadius={10}
            strength={0.85}
            className="min-w-0 flex-1"
          >
            <Input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about a supplier ID or compare risks…"
              aria-label="Ask the analyst"
              className="h-10 w-full text-base md:text-sm"
            />
          </BorderBeam>
          <Button
            type="submit"
            size="icon-lg"
            className="size-10"
            aria-label="Send question"
            disabled={!draft.trim()}
          >
            <ArrowUp />
          </Button>
        </form>
      </div>
    </div>
  )
}
