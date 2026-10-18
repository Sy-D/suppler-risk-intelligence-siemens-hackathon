"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"

import { streamAgent } from "@/lib/agent-events"
import type { Supplier } from "@/lib/supplier-data"

export interface ColumnInfo {
  value: string | number
  reason: string
  sources: string[]
}

export interface ResearchJob {
  id: string
  name: string
  updateId?: string
  status: "queued" | "running" | "done" | "error"
  activity: string[]
  supplier?: Supplier
  reasoning?: { columns: Record<string, ColumnInfo> }
  error?: string
}

interface EnqueueOptions {
  onDone?: (supplier: Supplier) => void
  onSelect?: (supplier: Supplier) => void
}

let jobCounter = 0

/** FIFO queue of research runs: jobs survive dialog close, run one at a
 * time, and report through sonner toasts. */
export function useResearchQueue() {
  const [jobs, setJobs] = useState<ResearchJob[]>([])
  const tail = useRef(Promise.resolve())

  function patch(id: string, changes: Partial<ResearchJob>) {
    setJobs((previous) =>
      previous.map((job) => (job.id === id ? { ...job, ...changes } : job))
    )
  }

  async function runJob(job: ResearchJob, options: EnqueueOptions) {
    patch(job.id, { status: "running" })
    let finishedSupplier: Supplier | undefined
    try {
      for await (const event of streamAgent("/api/research", {
        name: job.name,
        updateId: job.updateId,
      })) {
        if (event.type === "progress") {
          const line = event.text.replace("|", " — ")
          setJobs((previous) =>
            previous.map((j) =>
              j.id === job.id
                ? { ...j, activity: [...j.activity.slice(-19), line] }
                : j
            )
          )
        } else if (event.type === "result") {
          // SAFETY: the route emits {supplier, reasoning} as its result payload.
          const payload = event.payload as {
            supplier: Supplier
            reasoning: { columns: Record<string, ColumnInfo> }
          }
          patch(job.id, { supplier: payload.supplier, reasoning: payload.reasoning })
          finishedSupplier = payload.supplier
          options.onDone?.(payload.supplier)
        } else if (event.type === "error") {
          throw new Error(event.message)
        }
      }
      patch(job.id, { status: "done" })
      const supplier = finishedSupplier
      toast.success(`${job.name} researched`, {
        id: job.id,
        action: supplier
          ? {
              label: "View",
              onClick: () => options.onSelect?.(supplier),
            }
          : undefined,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Research failed"
      patch(job.id, { status: "error", error: message })
      toast.error(`Research failed: ${job.name}`, { id: job.id, description: message })
    }
  }

  function enqueue(name: string, updateId?: string, options: EnqueueOptions = {}) {
    const id = `job-${++jobCounter}`
    const job: ResearchJob = { id, name, updateId, status: "queued", activity: [] }
    setJobs((previous) => [...previous, job])
    const position = jobs.filter((j) => j.status === "queued" || j.status === "running").length
    toast.loading(`Researching ${name}…`, {
      id,
      description: position ? `Queued — position ${position + 1}` : "Starting",
    })
    tail.current = tail.current.then(() => runJob(job, options))
    return job.id
  }

  return { jobs, enqueue }
}
