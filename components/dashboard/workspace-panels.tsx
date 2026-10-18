"use client"

import { RiskBar } from "./risk-bar"
import {
  AnimatedNumber,
  deliveryFormat,
  exposureFormat,
} from "./animated-number"
import { useState } from "react"
import { ArrowUp, FileText, Globe, Search, Sparkles } from "lucide-react"
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
import {
  euro,
  RiskBadge,
  riskDimensions,
} from "@/components/dashboard/risk-badge"
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
                    <AnimatedNumber
                      value={s.delivery}
                      format={deliveryFormat}
                      suffix="%"
                    />
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
                    <AnimatedNumber
                      value={s.exposure}
                      format={exposureFormat}
                    />
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        )}
        <p className="text-xs text-muted-foreground">
          Source: supplier_risk_dataset.csv. Higher delivery ratings are better.
          Risk weights and component suitability are not provided.
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function answerQuestion(
  question: string,
  suppliers: Supplier[],
  selected: Supplier[]
) {
  const mentioned = new Set(question.toUpperCase().match(/SUPP_\d{5}/g))
  if (/financ|finanz/i.test(question)) {
    const candidates = mentioned.size
      ? suppliers.filter((s) => mentioned.has(s.id))
      : selected
    if (candidates.length === 0)
      return "Select suppliers or include their IDs to compare financial risk."
    const ranked = [...candidates].sort((a, b) => a.financial - b.financial)
    const best = ranked[0]
    return `${best.name} (${best.id}) has the lowest financial risk in this selection: ${best.financial}/100.\n\n${ranked.map((s) => `${s.id}: ${s.financial}/100`).join(" · ")}\n\nIts credit rating risk is ${best.credit}/100 and total risk is ${best.risk}/100. A financial lead alone is not an overall award recommendation.\n\nSource: Financial_Health_Score, Credit_Rating_Score, Total_Risk_Index.`
  }
  if (mentioned.size) {
    const supplier = suppliers.find(
      (s) => s.id === mentioned.values().next().value
    )
    if (!supplier)
      return "That supplier ID was not found in the dataset. Use an ID such as SUPP_00018."
    const concerns = [...riskDimensions]
      .sort((a, b) => supplier[b.key] - supplier[a.key])
      .slice(0, 3)
    return `${supplier.name} (${supplier.id}) has a total risk index of ${supplier.risk}/100 (${supplier.level.toLowerCase()} risk).\n\nThe highest scores across its financial, quality, operational, compliance, ESG, digital, governance and credit indicators are ${concerns.map((d) => `${d.label.toLowerCase()} ${supplier[d.key]}/100`).join(", ")}.\n\nDelivery rating: ${supplier.delivery.toFixed(2)}%. Purchase order exposure: ${euro.format(supplier.exposure)}.\n\nThese scores flag areas for review. The dataset does not provide the weights behind the total risk index, so exact contributions cannot be calculated.\n\nSource: supplier_risk_dataset.csv, row ${supplier.id}.`
  }
  return "This preview supports financial-risk comparisons and supplier risk profiles. Include supplier IDs or try one of the example questions above."
}

export function AnalystSheet({
  open,
  onOpenChange,
  suppliers,
  selected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  suppliers: Supplier[]
  selected: Supplier[]
}) {
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const prompts = [
    "Which of SUPP_00012, SUPP_00450 and SUPP_00731 has the lowest financial risk?",
    "Why is SUPP_00018’s total risk index so high?",
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader className="border-b pr-14">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            Ask your analyst
          </SheetTitle>
          <SheetDescription>
            Explore supplier risks with answers grounded in your data.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-2">
          <Badge variant="secondary">Dataset preview · example questions</Badge>
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                className="h-auto min-h-12 w-full justify-start py-3 text-left whitespace-normal"
                onClick={() => {
                  setQuestion(prompt)
                  setAnswer(answerQuestion(prompt, suppliers, selected))
                }}
              >
                {prompt}
              </Button>
            ))}
          </div>
          {answer ? (
            <div
              className="rounded-2xl bg-muted p-5 text-sm leading-relaxed whitespace-pre-line"
              role="status"
            >
              {answer}
            </div>
          ) : (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto mb-4 size-7 text-muted-foreground" />
              <h3 className="font-medium">Start with your shortlist.</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Compare financial risk, or take a closer look at a supplier’s
                risk profile.
              </p>
            </div>
          )}
        </div>
        <form
          className="space-y-3 border-t p-6"
          onSubmit={(event) => {
            event.preventDefault()
            if (question.trim())
              setAnswer(answerQuestion(question, suppliers, selected))
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
              placeholder="Ask about a supplier ID…"
            />
            <Button
              type="submit"
              size="icon-lg"
              className="size-11"
              aria-label="Ask question"
              disabled={!question.trim()}
            >
              <ArrowUp />
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <FileText className="size-3" />
            supplier_risk_dataset.csv · 10,000 suppliers
          </p>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function ResearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Research a real company</DialogTitle>
          <DialogDescription>
            The dataset is anonymized. External research needs a verified
            company name.
          </DialogDescription>
        </DialogHeader>
        <Badge variant="secondary" className="w-fit">
          Workflow preview
        </Badge>
        <ol className="space-y-5">
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
              text: "Follow red flags and produce a report with dated source links.",
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
        <p className="text-xs text-muted-foreground">
          External research will be connected in the next implementation step.
        </p>
      </DialogContent>
    </Dialog>
  )
}
