"use client"

import { useState } from "react"
import { streamAgent } from "@/lib/agent-events"
import type { AnswerBlock } from "@/lib/analyst/schema"

export interface AnalystTurn {
  question: string
  answer: string
  sql: string
  /** Dashboard view blocks, when the model found a useful visual. */
  blocks?: AnswerBlock[]
  failed?: boolean
}

/** Chat state for the text-to-SQL analyst (/api/analyst → scripts/ask.py).
 * Each question carries the last successful turn so follow-ups resolve. */
export function useAnalystChat() {
  const [turns, setTurns] = useState<AnalystTurn[]>([])
  const [pending, setPending] = useState("")
  const [activity, setActivity] = useState<string[]>([])
  const loading = pending !== ""

  async function ask(question: string) {
    if (loading) return
    const previous = turns.findLast((turn) => !turn.failed)
    setPending(question)
    setActivity([])
    const addTurn = (turn: AnalystTurn) => setTurns((all) => [...all, turn])
    try {
      for await (const event of streamAgent("/api/analyst", {
        question,
        previous: previous && {
          question: previous.question,
          sql: previous.sql,
          answer: previous.answer,
        },
      })) {
        if (event.type === "progress") {
          setActivity((prev) => [
            ...prev.slice(-19),
            event.text.replace("|", " — "),
          ])
        } else if (event.type === "result") {
          // SAFETY: the route emits {sql, answer, render} as its result
          // payload; render is validated against answerBlock server-side.
          const payload = event.payload as {
            sql?: string
            answer?: string
            render?: { blocks: AnswerBlock[] } | null
          }
          addTurn({
            question,
            sql: payload.sql ?? "",
            answer: payload.answer ?? "",
            blocks: payload.render?.blocks,
          })
        } else if (event.type === "error") {
          throw new Error(event.message)
        }
      }
    } catch (error) {
      addTurn({
        question,
        sql: "",
        failed: true,
        answer:
          error instanceof Error
            ? error.message
            : "The analyst could not be reached.",
      })
    } finally {
      setPending("")
    }
  }

  return {
    turns,
    pending,
    activity,
    loading,
    ask,
    clear: () => setTurns([]),
  }
}
