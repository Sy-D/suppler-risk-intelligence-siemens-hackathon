export type AgentEvent =
  | { type: "progress"; text: string }
  | { type: "result"; payload: unknown }
  | { type: "error"; message: string }

export interface AgentRequest {
  name?: string
  question?: string
}

/** Client-side reader for the SSE stream emitted by the agent routes. */
export async function* streamAgent(
  url: string,
  body: AgentRequest
): AsyncGenerator<AgentEvent> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok || !response.body) {
    throw new Error(`Request failed: ${response.status}`)
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  for (;;) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""
    for (const part of parts) {
      const line = part.replace(/^data: /, "")
      if (line) {
        // SAFETY: the agent routes emit exactly the AgentEvent union.
        yield JSON.parse(line) as AgentEvent
      }
    }
    if (done) return
  }
}
