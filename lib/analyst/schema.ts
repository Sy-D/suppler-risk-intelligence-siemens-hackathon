import { z } from "zod"

export const supplierId = z.string().regex(/^SUPP_\d{5}$/)

export const scoreDimension = z.enum([
  "risk",
  "financial",
  "quality",
  "operational",
  "compliance",
  "esg",
  "digital",
  "governance",
  "credit",
])

export const statDimension = z.enum([
  ...scoreDimension.options,
  "delivery",
  "exposure",
])

export const answerBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), markdown: z.string() }),
  z.object({
    type: z.literal("stat"),
    label: z.string().max(60),
    supplierId,
    dimension: statDimension,
    hint: z.string().max(120).optional(),
  }),
  z.object({
    type: z.literal("risk_bars"),
    supplierId,
    dimensions: z.array(scoreDimension).min(1).max(9),
    highlightTop: z.number().int().min(0).max(3).default(3),
  }),
  z.object({
    type: z.literal("mini_table"),
    columns: z
      .array(
        z.enum(["name", "risk", "level", "delivery", "exposure", "financial"])
      )
      .min(1)
      .max(5),
    supplierIds: z.array(supplierId).min(1).max(10),
    sortBy: z
      .enum(["risk", "delivery", "exposure", "financial"])
      .optional(),
    order: z.enum(["asc", "desc"]).default("asc"),
  }),
  z.object({
    type: z.literal("supplier_chips"),
    supplierIds: z.array(supplierId).min(1).max(20),
  }),
  z.object({
    type: z.literal("callout"),
    tone: z.enum(["info", "warning"]),
    text: z.string().max(280),
  }),
  z.object({ type: z.literal("source_note") }),
])

export const analystAnswer = z.object({
  summary: z.string().max(400),
  blocks: z.array(answerBlock).max(8),
})

export type AnswerBlock = z.infer<typeof answerBlock>
export type AnalystAnswer = z.infer<typeof analystAnswer>
export type StatDimension = z.infer<typeof statDimension>
export type ScoreDimension = z.infer<typeof scoreDimension>
