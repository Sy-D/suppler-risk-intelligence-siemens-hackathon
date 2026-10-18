"use client"

import { RiskBar } from "./risk-bar"
import {
  AnimatedNumber,
  deliveryFormat,
  exposureFormat,
} from "./animated-number"
import { useState } from "react"
import Link from "next/link"
import {
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Expand,
  FileText,
  Globe,
  LoaderCircle,
  Play,
  Search,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RiskBadge, riskDimensions } from "@/components/dashboard/risk-badge"
import { streamAgent } from "@/lib/agent-events"
import { matchSuppliers } from "@/lib/fuzzy-match"
import type { Supplier } from "@/lib/supplier-data"

interface ColumnInfo {
  value: string | number
  reason: string
  sources: string[]
}

const DERIVED_PREFIXES = [
  "derived from",
  "internal ERP",
  "auto-assigned",
  "CLI input",
  "UTC timestamp",
]

function domainOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

function SourceIcons({ sources }: { sources: string[] }) {
  if (!sources.length) return null
  return (
    <span className="inline-flex translate-y-0.5 items-center gap-1 pl-1 align-baseline">
      {sources.map((url) => {
        const domain = domainOf(url)
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            title={domain}
            aria-label={domain}
            className="inline-flex opacity-70 transition-opacity hover:opacity-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
              alt={domain}
              className="size-3.5 rounded-sm"
            />
          </a>
        )
      })}
    </span>
  )
}

function StepIcon({ line }: { line: string }) {
  const base = "mt-0.5 size-3.5 shrink-0"
  if (line.endsWith("done"))
    return <CheckCircle2 className={`${base} text-emerald-500`} />
  if (line.endsWith("started")) return <Play className={`${base} text-primary`} />
  if (line.includes("searching"))
    return <Search className={`${base} text-muted-foreground`} />
  if (line.includes("reading"))
    return <BookOpen className={`${base} text-muted-foreground`} />
  return <Sparkles className={`${base} text-muted-foreground`} />
}

export function ActivityLog({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="mt-3 max-h-40 space-y-1.5 overflow-y-auto border-t pt-3 font-mono text-[11px] text-muted-foreground">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <StepIcon line={line} />
          <span className="min-w-0 truncate">{line}</span>
        </li>
      ))}
    </ul>
  )
}

export function ComparisonDialog({
  open,
  onOpenChange,
  suppliers,
  mode = "compare",
}: {
  mode?: "compare" | "profile"
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: Supplier[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4 pr-10">
            <div className="space-y-2">
              <DialogTitle>
                {mode === "profile"
                  ? "Supplier risk profile"
                  : "Compare your shortlist"}
              </DialogTitle>
              <DialogDescription>
                {mode === "compare" ? (
                  <>
                    <AnimatedNumber value={suppliers.length} /> of 20 suppliers
                    ·{" "}
                  </>
                ) : (
                  ""
                )}
                Risk scores: 0 = no risk, 100 = maximum risk.
              </DialogDescription>
            </div>
            {suppliers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={`/compare?ids=${suppliers.map((s) => s.id).join(",")}`}
                  />
                }
              >
                <Expand data-icon="inline-start" />
                Full view
              </Button>
            )}
          </div>
        </DialogHeader>
        {suppliers.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Select suppliers in the overview to compare their risk profiles.
          </p>
        ) : (
          <ComparisonTable suppliers={suppliers} />
        )}
        <p className="text-xs text-muted-foreground">
          Source: supplier_risk_dataset.csv plus live web research (RSCH_*
          rows). Higher delivery ratings are better. Risk weights and component
          suitability are not provided.
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function ComparisonTable({ suppliers }: { suppliers: Supplier[] }) {
  return (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 min-w-40 bg-popover">
                  Risk profile
                </TableHead>
                {suppliers.map((s, i) => (
                  <TableHead
                    key={s.id}
                    className="min-w-48 align-top whitespace-normal motion-safe:animate-detail-in"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <div className="font-mono text-xs text-muted-foreground">
                      {s.id}
                    </div>
                    <div className="mt-2 font-medium text-foreground">
                      {s.name}
                    </div>
                    <div className="my-3">
                      <RiskBadge level={s.level} />
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-popover font-medium">
                  Total risk index
                </TableCell>
                {suppliers.map((s, i) => (
                  <TableCell
                    key={s.id}
                    className="text-2xl font-medium tabular-nums motion-safe:animate-detail-in"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    <AnimatedNumber value={s.risk} respectMotionPreference />
                    <span className="text-xs font-normal text-muted-foreground">
                      {" "}
                      / 100
                    </span>
                  </TableCell>
                ))}
              </TableRow>
              {riskDimensions.map((dimension) => (
                <TableRow key={dimension.key}>
                  <TableCell className="sticky left-0 z-10 bg-popover text-muted-foreground">
                    {dimension.label}
                  </TableCell>
                  {suppliers.map((s, i) => (
                    <TableCell
                      key={s.id}
                      className="motion-safe:animate-detail-in"
                      style={{ animationDelay: `${i * 45}ms` }}
                    >
                      <RiskBar value={s[dimension.key]} enter />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-popover text-muted-foreground">
                  Delivery rating ↑
                </TableCell>
                {suppliers.map((s, i) => (
                  <TableCell
                    key={s.id}
                    className="tabular-nums motion-safe:animate-detail-in"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    {s.researched ? (
                      "—"
                    ) : (
                      <AnimatedNumber
                        value={s.delivery}
                        format={deliveryFormat}
                        suffix="%"
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell className="sticky left-0 z-10 bg-popover text-muted-foreground">
                  PO exposure
                </TableCell>
                {suppliers.map((s, i) => (
                  <TableCell
                    key={s.id}
                    className="tabular-nums motion-safe:animate-detail-in"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    {s.researched ? (
                      "—"
                    ) : (
                      <AnimatedNumber
                        value={s.exposure}
                        format={exposureFormat}
                      />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
  )
}

export function AnalystSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [activity, setActivity] = useState<string[]>([])
  const prompts = [
    "What are the biggest current risk signals for Continental AG?",
    "Which recent events raise the risk of sourcing semiconductors from Nexperia?",
  ]
  async function ask(text: string) {
    setQuestion(text)
    setLoading(true)
    setAnswer("")
    setActivity([])
    try {
      for await (const event of streamAgent("/api/analyst", {
        question: text,
      })) {
        if (event.type === "progress") {
          setActivity((prev) => [
            ...prev.slice(-19),
            event.text.replace("|", " — "),
          ])
        } else if (event.type === "result") {
          // SAFETY: the route emits {answer} as its result payload.
          const payload = event.payload as { answer?: string }
          setAnswer(payload.answer ?? "")
        } else if (event.type === "error") {
          throw new Error(event.message)
        }
      }
    } catch (error) {
      setAnswer(
        error instanceof Error
          ? error.message
          : "The research agent could not be reached."
      )
    } finally {
      setLoading(false)
    }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="border-b pr-14">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Ask your analyst
          </SheetTitle>
          <SheetDescription>
            Explore supplier risks with answers grounded in live web research.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-2">
          <Badge variant="secondary">
            Live research · deep agent + web search
          </Badge>
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                className="h-auto min-h-12 w-full justify-start py-3 text-left whitespace-normal"
                disabled={loading}
                onClick={() => ask(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
          {loading ? (
            <div
              className="rounded-2xl bg-muted p-5 text-sm leading-relaxed"
              role="status"
            >
              <div className="flex items-start gap-3">
                <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
                <p>
                  Researching the web… the analyst plans, searches and reads
                  sources, so a run takes a minute or two.
                </p>
              </div>
              <ActivityLog lines={activity} />
            </div>
          ) : answer ? (
            <div
              className="rounded-2xl bg-muted p-5 text-sm leading-relaxed whitespace-pre-line"
              role="status"
            >
              {answer}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto mb-4 size-7 text-muted-foreground" />
              <h3 className="font-medium">Ask about a real supplier.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The analyst researches public sources and returns a cited risk
                answer.
              </p>
            </div>
          )}
        </div>
        <form
          className="space-y-3 border-t p-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (question.trim() && !loading) ask(question)
          }}
        >
          <label htmlFor="analyst-question" className="text-xs font-medium">
            Your question
          </label>
          <div className="flex gap-2">
            <Input
              id="analyst-question"
              className="h-11 min-w-0 flex-1 text-base md:text-sm"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about a supplier…"
            />
            <Button
              type="submit"
              size="icon-lg"
              className="size-11"
              aria-label="Ask question"
              disabled={!question.trim() || loading}
            >
              <ArrowUp />
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileText className="size-3" />
            deep research agent · Nebius Token Factory + Tavily
          </p>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function ResearchDialog({
  open,
  onOpenChange,
  onResearched,
  onSelectExisting,
  suppliers,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResearched: (supplier: Supplier) => void
  onSelectExisting: (supplier: Supplier) => void
  suppliers: Supplier[]
}) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Supplier | null>(null)
  const [activity, setActivity] = useState<string[]>([])
  const [reasoning, setReasoning] = useState<{
    columns: Record<string, ColumnInfo>
  } | null>(null)
  const [matches, setMatches] = useState<Supplier[] | null>(null)
  const [candidate, setCandidate] = useState<string | null>(null)

  async function checkFirst() {
    const hits = matchSuppliers(name, suppliers)
    if (hits.length) {
      setMatches(hits)
      return
    }
    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()
      const canonical = String(data.canonical ?? "")
        .trim()
      if (canonical && canonical.toLowerCase() !== name.trim().toLowerCase()) {
        setCandidate(canonical)
        return
      }
    } catch {
      // resolver unreachable — proceed with the name as typed
    }
    run()
  }

  async function run(override?: string) {
    const target = override ?? name
    setMatches(null)
    setCandidate(null)
    setLoading(true)
    setError("")
    setResult(null)
    setReasoning(null)
    setActivity([])
    try {
      for await (const event of streamAgent("/api/research", {
        name: target,
      })) {
        if (event.type === "progress") {
          setActivity((prev) => [
            ...prev.slice(-19),
            event.text.replace("|", " — "),
          ])
        } else if (event.type === "result") {
          // SAFETY: the route emits {supplier, reasoning} as its result payload.
          const payload = event.payload as {
            supplier: Supplier
            reasoning: { columns: Record<string, ColumnInfo> }
          }
          setResult(payload.supplier)
          setReasoning(payload.reasoning)
          onResearched(payload.supplier)
        } else if (event.type === "error") {
          throw new Error(event.message)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed")
    } finally {
      setLoading(false)
    }
  }

  const evidence = reasoning
    ? Object.entries(reasoning.columns).filter(
        ([, info]) =>
          info.reason &&
          !DERIVED_PREFIXES.some((prefix) => info.reason.startsWith(prefix))
      )
    : []

  const topDimensions = result
    ? [...riskDimensions].sort((a, b) => result[b.key] - result[a.key]).slice(0, 3)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Research a real company</DialogTitle>
          <DialogDescription>
            The dataset is anonymized. Enter a verified company name — the deep
            research agent investigates public sources, scores the risk
            dimensions, and adds the supplier to your comparison list.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim() && !loading) checkFirst()
          }}
        >
          <Input
            className="h-11 min-w-0 flex-1 text-base md:text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Company name or ID, e.g. Continental AG / SUPP_00018"
            disabled={loading}
          />
          <Button
            type="submit"
            className="h-11"
            disabled={!name.trim() || loading}
          >
            <Search className="size-4" />
            Research
          </Button>
        </form>
        {matches ? (
          <div className="space-y-2 rounded-2xl bg-muted p-4">
            <p className="text-xs font-medium">
              Already in your dataset — pick a match to select it, or research
              anyway.
            </p>
            {matches.map((supplier) => (
              <button
                key={supplier.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left hover:bg-background"
                onClick={() => onSelectExisting(supplier)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {supplier.name}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {supplier.id}
                  </span>
                </span>
                <RiskBadge level={supplier.level} />
              </button>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => run()}
            >
              Not a match — research anyway
            </Button>
          </div>
        ) : null}
        {candidate ? (
          <div className="space-y-3 rounded-2xl bg-muted p-4">
            <p className="text-sm">
              Did you mean <span className="font-semibold">{candidate}</span>?
            </p>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => {
                  setName(candidate)
                  run(candidate)
                }}
              >
                Research {candidate}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => run()}
              >
                Research “{name}”
              </Button>
            </div>
          </div>
        ) : null}
        {loading ? (
          <div
            className="rounded-2xl bg-muted p-5 text-sm leading-relaxed"
            role="status"
          >
            <div className="flex items-start gap-3">
              <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
              <p>
                Researching {result?.name ?? name}… {activity.length === 0 &&
                  "the criteria agents are starting up."}
              </p>
            </div>
            <ActivityLog lines={activity} />
          </div>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-muted p-5 text-sm leading-relaxed">
            {error}
          </p>
        ) : null}
        {result ? (
          <div className="space-y-4 rounded-2xl bg-muted p-5" role="status">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{result.name}</p>
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {result.id}
                </p>
              </div>
              <RiskBadge level={result.level} />
            </div>
            <div className="text-2xl font-medium tabular-nums">
              {result.risk}
              <span className="text-xs font-normal text-muted-foreground">
                {" "}
                / 100 total risk
              </span>
            </div>
            <div className="space-y-2">
              {topDimensions.map((dimension) => (
                <div key={dimension.key}>
                  <p className="mb-1 text-xs text-muted-foreground">
                    {dimension.label}
                  </p>
                  <RiskBar value={result[dimension.key]} enter />
                </div>
              ))}
            </div>
            {evidence.length > 0 && (
              <div className="border-t pt-3">
                <p className="mb-2 text-xs font-medium">Evidence & sources</p>
                <ul className="max-h-56 space-y-3 overflow-y-auto pr-1">
                  {evidence.map(([column, info]) => (
                    <li key={column} className="text-xs">
                      <p className="font-medium">
                        {column} = {String(info.value)}
                      </p>
                      <p className="mt-0.5 leading-relaxed text-muted-foreground">
                        {info.reason}
                        <SourceIcons sources={info.sources} />
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Globe className="size-3" />
              Added to the supplier list and selected for comparison. Internal
              delivery and order data is not researched and shows as —.
            </p>
          </div>
        ) : null}
        {!loading && !result && !error ? (
          <ol className="space-y-4 border-t pt-4">
            {[
              {
                title: "Plan the investigation",
                text: "Confirm the company identity and the risk areas to examine.",
                icon: Search,
              },
              {
                title: "Review public evidence",
                text: "Check company filings, official sources and recent news.",
                icon: Globe,
              },
              {
                title: "Investigate and cite",
                text: "Follow red flags and score each risk dimension from sourced findings.",
                icon: FileText,
              },
            ].map((step) => (
              <li key={step.title} className="flex gap-3">
                <step.icon className="mt-1 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
