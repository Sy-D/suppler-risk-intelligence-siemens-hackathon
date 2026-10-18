"use client"

import { z } from "zod"
import type { Supplier } from "@/lib/supplier-data"
import {
  answerBlock,
  analystAnswer,
  type AnalystAnswer,
  type AnswerBlock,
} from "@/lib/analyst/schema"
import {
  CalloutBlock,
  MiniTableBlock,
  RiskBarsBlock,
  SourceNoteBlock,
  StatBlock,
  SupplierChipsBlock,
  TextBlock,
  type BlockContext,
} from "./blocks"

function Block({ spec, ctx }: { spec: unknown; ctx: BlockContext }) {
  const parsed = answerBlock.safeParse(spec)
  if (!parsed.success) {
    const asText = z.string().safeParse(spec)
    return (
      <TextBlock
        block={{
          type: "text",
          markdown: asText.success
            ? asText.data
            : "Could not render this part of the answer.",
        }}
      />
    )
  }
  const block = parsed.data
  switch (block.type) {
    case "text":
      return <TextBlock block={block} />
    case "stat":
      return <StatBlock block={block} {...ctx} />
    case "risk_bars":
      return <RiskBarsBlock block={block} {...ctx} />
    case "mini_table":
      return <MiniTableBlock block={block} {...ctx} />
    case "supplier_chips":
      return <SupplierChipsBlock block={block} {...ctx} />
    case "callout":
      return <CalloutBlock block={block} />
    case "source_note":
      return <SourceNoteBlock />
  }
}

export function AnswerBlocks({
  answer,
  suppliers,
  onOpenProfile,
}: {
  answer: AnalystAnswer
  suppliers: Supplier[]
  onOpenProfile: (supplier: Supplier) => void
}) {
  const parsed = analystAnswer.safeParse(answer)
  if (!parsed.success)
    return <p className="text-sm whitespace-pre-line">{answer.summary}</p>
  return (
    <div className="space-y-3">
      <p className="text-sm leading-relaxed">{parsed.data.summary}</p>
      <BlockList
        blocks={parsed.data.blocks}
        suppliers={suppliers}
        onOpenProfile={onOpenProfile}
      />
    </div>
  )
}

export function BlockList({
  blocks,
  suppliers,
  onOpenProfile,
}: {
  blocks: AnswerBlock[]
  suppliers: Supplier[]
  onOpenProfile: (supplier: Supplier) => void
}) {
  const ctx: BlockContext = { suppliers, onOpenProfile }
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div
          key={i}
          className="motion-safe:animate-detail-in"
          style={{ animationDelay: `${i * 45}ms` }}
        >
          <Block spec={block} ctx={ctx} />
        </div>
      ))}
    </div>
  )
}
