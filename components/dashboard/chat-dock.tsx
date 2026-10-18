"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useTheme } from "next-themes"
import { BorderBeam } from "border-beam"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import {
  ArrowUp,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Sparkles,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { AnswerBlocks } from "@/components/analyst/answer-blocks"
import { composeAnswer } from "@/lib/analyst/compose"
import { matchSuppliers } from "@/lib/fuzzy-match"
import type { AnalystAnswer } from "@/lib/analyst/schema"
import type { Supplier } from "@/lib/supplier-data"

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; answer: AnalystAnswer }

type SpeechRecognitionResultItem = {
  isFinal: boolean
  [index: number]: { transcript: string }
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<SpeechRecognitionResultItem>
  }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
}

// Only called from effects and event handlers — always client-side.
function getSpeechRecognition(): SpeechRecognitionCtor | null {
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

type TemplateSegment =
  | { kind: "text"; text: string }
  | { kind: "ph"; label: string }

type PromptTemplate = {
  raw: string
  segments: TemplateSegment[]
  values: string[]
}

function parseTemplate(raw: string): PromptTemplate | null {
  const segments: TemplateSegment[] = []
  const values: string[] = []
  let last = 0
  for (const match of raw.matchAll(/\{([^{}]+)\}/g)) {
    if (match.index > last)
      segments.push({ kind: "text", text: raw.slice(last, match.index) })
    segments.push({ kind: "ph", label: match[1].trim() })
    values.push("")
    last = match.index + match[0].length
  }
  if (last < raw.length)
    segments.push({ kind: "text", text: raw.slice(last) })
  return values.length ? { raw, segments, values } : null
}

function renderPillLabel(raw: string) {
  const parts = raw.split(/(\{[^{}]+\})/g)
  return parts.map((part, i) =>
    part.startsWith("{") && part.endsWith("}") ? (
      <span
        key={i}
        className="border-b border-dashed border-blue-500 text-blue-600 dark:text-blue-400"
      >
        {part.slice(1, -1)}
      </span>
    ) : (
      part
    )
  )
}

const EXAMPLE_PROMPTS = [
  "What is the risk of {supplier}?",
  "Compare {supplier A} with {supplier B} financially",
  "Which selected supplier has the lowest financial risk?",
]

const SUPPLIER_PH = /supplier/i

/** Inline template field with supplier typeahead. Accepts a name or an ID —
 * picking a suggestion writes the supplier's name into the field. The popup
 * renders in a portal and flips above the field when there is no room below. */
function SupplierPhInput({
  value,
  label,
  next,
  suppliers,
  inputRef,
  onChange,
  onFocus,
}: {
  value: string
  label: string
  next: boolean
  suppliers: Supplier[]
  inputRef: (el: HTMLInputElement | null) => void
  onChange: (value: string) => void
  onFocus: () => void
}) {
  const suggestions = useMemo(() => {
    const query = value.trim()
    if (!query) return []
    const hits = matchSuppliers(query, suppliers, 6)
    const upper = query.toUpperCase()
    const byId = suppliers.filter(
      (s) => s.id.startsWith(upper) && !hits.includes(s)
    )
    return [...hits, ...byId].slice(0, 6)
  }, [value, suppliers])

  return (
    <Combobox
      items={suggestions}
      filter={null}
      itemToStringLabel={(supplier: Supplier) => supplier.name}
      inputValue={value}
      onInputValueChange={(nextValue, details) => {
        if (details.reason === "input-change") onChange(nextValue)
      }}
      onValueChange={(supplier: Supplier | null) => {
        if (supplier) onChange(supplier.name)
      }}
    >
      <ComboboxPrimitive.Input
        ref={inputRef}
        render={
          <input
            placeholder={label}
            size={Math.max(value.length, label.length, 2)}
            aria-label={label}
            onFocus={onFocus}
            className={`mx-0.5 min-w-8 rounded-sm border-b px-0.5 outline-none transition-colors placeholder:text-blue-500/60 ${
              next
                ? "border-dashed border-blue-500 bg-blue-500/10"
                : "border-dashed border-blue-500/50"
            }`}
          />
        }
      />
      <ComboboxContent className="w-72">
        <ComboboxEmpty className="p-3 text-xs">
          No matching suppliers.
        </ComboboxEmpty>
        <ComboboxList>
          {(supplier: Supplier) => (
            <ComboboxItem key={supplier.id} value={supplier}>
              <div className="min-w-0">
                <p className="truncate">{supplier.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {supplier.id}
                </p>
              </div>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
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
  selected,
  onClose,
  onOpenProfile,
}: Omit<React.ComponentProps<typeof ChatDock>, "open">) {
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [full, setFull] = useState(false)
  const [listening, setListening] = useState(false)
  const [template, setTemplate] = useState<PromptTemplate | null>(null)
  const [tabHint, setTabHint] = useState(false)
  const speechSupported = useSyncExternalStore(
    () => () => {},
    () => getSpeechRecognition() !== null,
    () => false
  )
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const draftBaseRef = useRef("")
  const phRefs = useRef<(HTMLInputElement | null)[]>([])
  const phFocusRef = useRef(-1)
  const { resolvedTheme } = useTheme()

  const firstEmptyPh = template ? template.values.findIndex((v) => !v.trim()) : -1

  useEffect(() => () => recognitionRef.current?.abort(), [])

  useEffect(() => {
    if (!template) return
    phFocusRef.current = -1
    const target = template.values.findIndex((v) => !v.trim())
    phRefs.current[target === -1 ? 0 : target]?.focus()
    const timer = setTimeout(() => setTabHint(true), 1500)
    return () => {
      clearTimeout(timer)
      setTabHint(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.raw])

  function updatePh(index: number, value: string) {
    setTemplate((t) =>
      t ? { ...t, values: t.values.map((v, j) => (j === index ? value : v)) } : t
    )
  }

  function pickExample(raw: string) {
    const parsed = parseTemplate(raw)
    if (parsed) {
      setDraft("")
      setTemplate(parsed)
    } else {
      setTemplate(null)
      setDraft(raw)
      inputRef.current?.focus()
    }
  }

  function clearField() {
    setDraft("")
    setTemplate(null)
    recognitionRef.current?.stop()
    inputRef.current?.focus()
  }

  function templateText(t: PromptTemplate) {
    let pi = 0
    return t.segments
      .map((s) => (s.kind === "text" ? s.text : t.values[pi++].trim()))
      .join("")
      .trim()
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const Ctor = getSpeechRecognition()
    if (!Ctor) return
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || "en-US"
    let phTarget = -1
    if (template) {
      const focused = phFocusRef.current
      const empty = template.values.findIndex((v) => !v.trim())
      phTarget = focused >= 0 ? focused : empty >= 0 ? empty : template.values.length - 1
      draftBaseRef.current = (template.values[phTarget] ?? "").trim()
    } else {
      draftBaseRef.current = draft.trim()
    }
    let final = ""
    recognition.onresult = (event) => {
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }
      const spoken = `${final}${interim}`.trim()
      const joined = [draftBaseRef.current, spoken].filter(Boolean).join(" ")
      if (phTarget >= 0) {
        setTemplate((t) =>
          t
            ? {
                ...t,
                values: t.values.map((v, j) => (j === phTarget ? joined : v)),
              }
            : t
        )
      } else {
        setDraft(joined)
      }
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
    if (phTarget >= 0) phRefs.current[phTarget]?.focus()
    else inputRef.current?.focus()
  }

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

  // Grow the textarea with the draft, capped at ~6 lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 136)}px`
  }, [draft])

  useEffect(() => {
    function onType(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "Escape") {
        if (document.querySelector('[data-slot="combobox-content"][data-open]'))
          return
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
      if (template) {
        const empty = template.values.findIndex((v) => !v.trim())
        const target = empty >= 0 ? empty : template.values.length - 1
        updatePh(target, (template.values[target] ?? "") + event.key)
        phRefs.current[target]?.focus()
        return
      }
      setDraft((d) => d + event.key)
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", onType)
    return () => document.removeEventListener("keydown", onType)
  }, [onClose, template])

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
        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className={`space-y-3 overflow-y-auto px-4 py-3 ${
              full ? "flex-1" : "max-h-[42svh]"
            }`}
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
        {messages.length === 0 && !template && !draft && (
          <div className="flex flex-wrap gap-2 border-t px-4 pb-1 pt-3">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={prompt}
                type="button"
                onClick={() => pickExample(prompt)}
                className="rounded-full border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground motion-safe:animate-detail-in"
                style={{ animationDelay: `${200 + i * 90}ms` }}
              >
                {renderPillLabel(prompt)}
              </button>
            ))}
          </div>
        )}
        <form
          className="relative flex items-center gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (template) {
              const empty = template.values.findIndex((v) => !v.trim())
              if (empty !== -1) {
                phRefs.current[empty]?.focus()
                return
              }
            }
            const question = template ? templateText(template) : draft.trim()
            if (!question) return
            recognitionRef.current?.stop()
            setDraft("")
            setTemplate(null)
            ask(question)
          }}
        >
          {tabHint && template && (
            <div className="pointer-events-none absolute -top-7 right-3 rounded-md border bg-popover px-2 py-1 text-[10px] text-muted-foreground shadow-sm motion-safe:animate-detail-in">
              <kbd className="font-medium">⇥ Tab</kbd> jump to next field
            </div>
          )}
          <BorderBeam
            size="md"
            theme={resolvedTheme === "light" ? "light" : "dark"}
            borderRadius={999}
            strength={0.85}
            className="min-w-0 flex-1"
          >
            <div className="relative">
              {template ? (
                <div
                  role="group"
                  aria-label="Fill in the question template"
                  className="flex h-10 w-full min-w-0 items-center overflow-x-auto rounded-4xl border border-input bg-input/30 pl-3 pr-20 text-base md:text-sm"
                >
                  {(() => {
                    let phIndex = -1
                    return template.segments.map((segment, i) => {
                      if (segment.kind === "text") {
                        return (
                          <span key={i} className="whitespace-pre">
                            {segment.text}
                          </span>
                        )
                      }
                      phIndex += 1
                      const index = phIndex
                      const value = template.values[index]
                      const next = index === firstEmptyPh
                      if (SUPPLIER_PH.test(segment.label)) {
                        return (
                          <SupplierPhInput
                            key={i}
                            value={value}
                            label={segment.label}
                            next={next}
                            suppliers={suppliers}
                            inputRef={(el) => {
                              phRefs.current[index] = el
                            }}
                            onChange={(nextValue) =>
                              updatePh(index, nextValue)
                            }
                            onFocus={() => {
                              phFocusRef.current = index
                            }}
                          />
                        )
                      }
                      return (
                        <input
                          key={i}
                          ref={(el) => {
                            phRefs.current[index] = el
                          }}
                          value={value}
                          placeholder={segment.label}
                          size={Math.max(value.length, segment.label.length, 2)}
                          aria-label={segment.label}
                          onFocus={() => {
                            phFocusRef.current = index
                          }}
                          onChange={(event) =>
                            updatePh(index, event.target.value)
                          }
                          className={`mx-0.5 min-w-8 rounded-sm border-b px-0.5 outline-none transition-colors placeholder:text-blue-500/60 ${
                            next
                              ? "border-dashed border-blue-500 bg-blue-500/10"
                              : "border-dashed border-blue-500/50"
                          }`}
                        />
                      )
                    })
                  })()}
                </div>
              ) : (
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                  placeholder="Ask about a supplier ID or compare risks…"
                  aria-label="Ask the analyst"
                  className="min-h-10 w-full min-w-0 resize-none overflow-y-auto rounded-4xl border border-input bg-input/30 px-3 py-2.5 pr-20 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                />
              )}
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
                {speechSupported && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={
                      listening ? "Stop voice input" : "Start voice input"
                    }
                    aria-pressed={listening}
                    onClick={toggleListening}
                    className={listening ? "text-destructive motion-safe:animate-pulse" : ""}
                  >
                    {listening ? <MicOff /> : <Mic />}
                  </Button>
                )}
                {(draft || template) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Clear input"
                    onClick={clearField}
                  >
                    <X />
                  </Button>
                )}
              </div>
            </div>
          </BorderBeam>
          <Button
            type="submit"
            size="icon-lg"
            className="size-10"
            aria-label="Send question"
            disabled={!template && !draft.trim()}
          >
            <ArrowUp />
          </Button>
        </form>
      </div>
    </div>
  )
}
