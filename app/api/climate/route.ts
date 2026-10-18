import { cached } from "@/lib/cache"

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

interface MonthAggregate {
  month: string
  temp: number
  precip: number
}

async function fetchClimate(lat: number, lon: number): Promise<MonthAggregate[]> {
  const end = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - 1)
  const format = (d: Date) => d.toISOString().slice(0, 10)
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}` +
    `&longitude=${lon}&start_date=${format(start)}&end_date=${format(end)}` +
    `&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`
  const response = await fetch(url, { next: { revalidate: 86400 } })
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`)
  // SAFETY: Open-Meteo's documented archive response shape; nulls are handled.
  const data = (await response.json()) as {
    daily: {
      time: string[]
      temperature_2m_mean: (number | null)[]
      precipitation_sum: (number | null)[]
    }
  }
  const buckets = Array.from({ length: 12 }, () => ({
    tempSum: 0,
    tempCount: 0,
    precip: 0,
  }))
  data.daily.time.forEach((day, i) => {
    const month = Number(day.slice(5, 7)) - 1
    const temp = data.daily.temperature_2m_mean[i]
    const rain = data.daily.precipitation_sum[i]
    if (temp !== null) {
      buckets[month].tempSum += temp
      buckets[month].tempCount += 1
    }
    if (rain !== null) buckets[month].precip += rain
  })
  return buckets.map((bucket, i) => ({
    month: MONTH_NAMES[i],
    temp: bucket.tempCount
      ? Math.round((bucket.tempSum / bucket.tempCount) * 10) / 10
      : 0,
    precip: Math.round(bucket.precip),
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const lat = Number(searchParams.get("lat"))
  const lon = Number(searchParams.get("lon"))
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json({ error: "lat and lon required" }, { status: 400 })
  }
  try {
    const months = await cached(
      `climate:${lat.toFixed(2)}:${lon.toFixed(2)}`,
      60 * 60 * 24,
      () => fetchClimate(lat, lon)
    )
    return Response.json({ months })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Climate lookup failed" },
      { status: 502 }
    )
  }
}
