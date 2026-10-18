import { z } from "zod"
import { agentEventStream } from "@/lib/agent-stream"
import { answerBlock } from "@/lib/analyst/schema"

// The script is configurable via env and resolves from the repo root (cwd).
// The interpreter comes from ANALYST_PYTHON (see lib/agent-stream.ts).
const ANALYST_SCRIPT = process.env.ANALYST_SCRIPT ?? "scripts/ask.py"
// scripts/ask.py rejects questions longer than this.
const MAX_QUESTION_CHARS = 500
const MAX_CONTEXT_CHARS = 4000

const context = z.string().max(MAX_CONTEXT_CHARS * 2).catch("")
const requestBody = z.object({
  question: z.string(),
  // The previous turn of the chat, used to resolve follow-up questions.
  previous: z
    .object({ question: context, sql: context, answer: context })
    .optional()
    .catch(undefined),
})
const analystOutput = z.object({
  sql: z.string(),
  answer: z.string(),
  // Optional dashboard view; an invalid view is dropped, the answer is kept.
  render: z
    .object({ blocks: z.array(answerBlock).min(1).max(8) })
    .nullable()
    .catch(null),
})

export async function POST(request: Request) {
  const body = requestBody.safeParse(
    await request.json().catch(() => undefined)
  )
  const question = (body.success ? body.data.question : "")
    .trim()
    .slice(0, MAX_QUESTION_CHARS)
  if (!body.success || !question) {
    return Response.json({ error: "Missing question" }, { status: 400 })
  }
  const { previous } = body.data
  return agentEventStream(
    [ANALYST_SCRIPT, question, "--json", "--context-stdin", "--render"],
    (stdout) => analystOutput.parse(JSON.parse(stdout)),
    { cwd: process.cwd(), stdin: previous ? JSON.stringify(previous) : "" }
  )
}
