"use client"

import { useEffect, useRef, useState } from "react"
import NumberFlow, {
  type NumberFlowProps,
  type Format,
  usePrefersReducedMotion,
} from "@number-flow/react"

const timing = { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
const format = new Intl.NumberFormat("en-GB")

export function AnimatedNumber({
  value,
  ...props
}: Omit<NumberFlowProps, "value"> & { value: number }) {
  const [entered, setEntered] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: "100px" }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible) return
    let revealFrame = 0
    const frame = requestAnimationFrame(() => {
      revealFrame = requestAnimationFrame(() => setEntered(true))
    })
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(revealFrame)
    }
  }, [visible])
  return (
    <span ref={ref} className="contents">
      {visible ? (
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
      ) : (
        <span className="tabular-nums">{format.format(value)}</span>
      )}
    </span>
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
