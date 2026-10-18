"use client"

import { MarkdownAnswer } from "./markdown-answer"
import { RiskBar } from "./risk-bar"
import {
  AnimatedNumber,
  deliveryFormat,
  exposureFormat,
} from "./animated-number"
import { useState } from "react"
import {
  ArrowUp,
  FileText,
  Globe,
  LoaderCircle,
  Search,
  Sparkles,
  Trash2,
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
import type { Supplier } from "@/lib/supplier-data"

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
          <DialogTitle>
            {mode === "profile"
              ? "Supplier risk profile"
              : "Compare your shortlist"}
          </DialogTitle>
          <DialogDescription>
            {mode === "compare" ? (
              <>
                <AnimatedNumber value={suppliers.length} /> of 20 suppliers ·{" "}
              </>
            ) : (
              ""
            )}
            Risk scores: 0 = no risk, 100 = maximum risk.
          </DialogDescription>
        </DialogHeader>
        {suppliers.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            Select suppliers in the overview to compare their risk profiles.
          </p>
        ) : (
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

type AnalystTurn = {
  question: string
  answer: string
  sql: string
  failed?: boolean
}

async function askAnalyst(
  question: string,
  previous?: AnalystTurn
): Promise<{ answer: string; sql: string }> {
  const response = await fetch("/api/analyst", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      previous: previous && {
        question: previous.question,
        sql: previous.sql,
        answer: previous.answer,
      },
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error ?? "The analyst failed")
  }
  return { answer: data.answer, sql: data.sql }
}

export function AnalystSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<AnalystTurn[]>([])
  const [pending, setPending] = useState("")
  const loading = pending !== ""
  const prompts = [
    "Which 5 suppliers have the highest total risk?",
    "How many suppliers are rated Critical, and what is their average financial health score?",
  ]
  async function ask(text: string) {
    // The last successful turn gives the model context for follow-ups.
    const previous = turns.findLast((turn) => !turn.failed)
    setPending(text)
    setQuestion("")
    try {
      const result = await askAnalyst(text, previous)
      setTurns((all) => [...all, { question: text, ...result }])
    } catch (error) {
      setTurns((all) => [
        ...all,
        {
          question: text,
          sql: "",
          failed: true,
          answer:
            error instanceof Error
              ? error.message
              : "The analyst could not be reached.",
        },
      ])
    } finally {
      setPending("")
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
            Ask questions about the supplier dataset in plain language.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-2">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary">Text-to-SQL · supplier dataset</Badge>
            {turns.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => {
                  setTurns([])
                  setQuestion("")
                }}
              >
                <Trash2 data-icon="inline-start" />
                Clear chat
              </Button>
            )}
          </div>
          {turns.length === 0 && !loading && (
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  className="h-auto min-h-12 w-full justify-start py-3 text-left whitespace-normal"
                  onClick={() => ask(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          )}
          {turns.map((turn, index) => (
            <div key={index} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                {turn.question}
              </p>
              {turn.failed ? (
                <div className="rounded-2xl bg-destructive/10 p-5 text-sm leading-relaxed whitespace-pre-line text-destructive">
                  {turn.answer}
                </div>
              ) : (
                <div className="rounded-2xl bg-muted p-5 text-sm leading-relaxed">
                  <MarkdownAnswer>{turn.answer}</MarkdownAnswer>
                </div>
              )}
            </div>
          ))}
          {loading ? (
            <div className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                {pending}
              </p>
              <div
                className="flex items-start gap-3 rounded-2xl bg-muted p-5 text-sm leading-relaxed"
                role="status"
              >
                <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
                <p>
                  Querying the dataset… the analyst writes SQL, runs it and
                  summarises the results.
                </p>
              </div>
            </div>
          ) : turns.length > 0 ? null : (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto mb-4 size-7 text-muted-foreground" />
              <h3 className="font-medium">Ask about your suppliers.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The analyst turns your question into a query over the supplier
                dataset and explains the results.
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
              placeholder={
                turns.length ? "Ask a follow-up…" : "Ask about a supplier…"
              }
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
            DuckDB + Nebius Token Factory
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
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResearched: (supplier: Supplier) => void
}) {
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<Supplier | null>(null)

  async function run() {
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? "Research failed")
      setResult(data.supplier)
      onResearched(data.supplier)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed")
    } finally {
      setLoading(false)
    }
  }

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
            if (name.trim() && !loading) run()
          }}
        >
          <Input
            className="h-11 min-w-0 flex-1 text-base md:text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Company name, e.g. Continental AG"
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
        {loading ? (
          <div
            className="flex items-start gap-3 rounded-2xl bg-muted p-5 text-sm leading-relaxed"
            role="status"
          >
            <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" />
            <p>
              Researching {name}… the agent plans, searches and reads sources
              before scoring, so a run takes a minute or two.
            </p>
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
