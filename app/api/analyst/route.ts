import { agentEventStream } from "@/lib/agent-stream"

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined)
  const question = String(body?.question ?? "")
    .trim()
    .slice(0, 2000)
  if (!question) {
    return Response.json({ error: "Missing question" }, { status: 400 })
  }
  return agentEventStream(["analyst.py", question], (stdout) => ({
    answer: stdout,
  }))
}
