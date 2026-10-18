"use client"

import { useEffect, useState } from "react"
import NumberFlow, {
  type NumberFlowProps,
  type Format,
  usePrefersReducedMotion,
} from "@number-flow/react"

const timing = { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }

export function AnimatedNumber({
  value,
  ...props
}: Omit<NumberFlowProps, "value"> & { value: number }) {
  const [entered, setEntered] = useState(false)
  const reducedMotion = usePrefersReducedMotion()
  useEffect(() => {
    let revealFrame = 0
    const frame = requestAnimationFrame(() => {
      revealFrame = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(revealFrame)
    }
  }, [])
  return (
    <NumberFlow
      locales="en-GB"
      trend={0}
      transformTiming={timing}
      spinTiming={timing}
      opacityTiming={{ duration: 180, easing: "ease-out" }}
      respectMotionPreference
      {...props}
      value={entered || reducedMotion ? value : 0}
    />
  )
}

export const deliveryFormat: Format = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}
export const exposureFormat: Format = {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 2,
}
