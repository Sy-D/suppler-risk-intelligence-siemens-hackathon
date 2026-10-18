"use client"

import { useEffect, useRef, useState } from "react"
import NumberFlow, {
  type NumberFlowProps,
  type Format,
  usePrefersReducedMotion,
} from "@number-flow/react"

const timing = { duration: 420, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }

function plainFormat(
  value: number,
  format?: Format,
  prefix?: string,
  suffix?: string
) {
  const text = new Intl.NumberFormat("en-GB", format).format(value)
  return `${prefix ?? ""}${text}${suffix ?? ""}`
}

export function AnimatedNumber({
  value,
  format: numberFormat,
  prefix,
  suffix,
  animate = true,
  ...props
}: Omit<NumberFlowProps, "value"> & { value: number; animate?: boolean }) {
  const [entered, setEntered] = useState(false)
  const [visible, setVisible] = useState(!animate)
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
  if (!animate) {
    return (
      <span className="tabular-nums">
        {plainFormat(value, numberFormat, prefix, suffix)}
      </span>
    )
  }
  return (
    <span ref={ref}>
      {visible ? (
        <NumberFlow
          locales="en-GB"
          trend={0}
          transformTiming={timing}
          spinTiming={timing}
          opacityTiming={{ duration: 180, easing: "ease-out" }}
          respectMotionPreference
          format={numberFormat}
          prefix={prefix}
          suffix={suffix}
          {...props}
          value={entered || reducedMotion ? value : 0}
        />
      ) : (
        <span className="tabular-nums">
          {plainFormat(value, numberFormat, prefix, suffix)}
        </span>
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
