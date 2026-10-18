import { cached } from "@/lib/cache"

const HOST_PATTERN = /https:\/\/([a-z0-9.-]*openfreemap\.org)/g
const TTL = 60 * 60 * 24 * 7

/**
 * Proxies OpenFreeMap style JSON, vector tiles, glyphs and sprites through a
 * shared cache so repeated map mounts and page loads don't hit the CDN.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const hasHost = path[0].includes(".")
  const host = hasHost ? path[0] : "tiles.openfreemap.org"
  const upstreamPath = hasHost ? path.slice(1).join("/") : path.join("/")
  const origin = new URL(request.url).origin

  try {
    const payload = await cached(`tile:${host}/${upstreamPath}`, TTL, async () => {
      const response = await fetch(`https://${host}/${upstreamPath}`, {
        headers: { "User-Agent": "supplier-risk-dashboard" },
      })
      if (!response.ok) throw new Error(`upstream ${response.status}`)
      const type = response.headers.get("content-type") ?? ""
      if (type.includes("json")) {
        const text = await response.text()
        const rewritten = text.replace(
          HOST_PATTERN,
          (_match, host: string) => `${origin}/api/map-proxy/${host}`
        )
        return { type, body: rewritten }
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      return { type, body: buffer.toString("base64") }
    })

    const isJson = payload.type.includes("json")
    return new Response(
      isJson ? payload.body : Buffer.from(payload.body, "base64"),
      {
        headers: {
          "Content-Type":
            payload.type ||
            (upstreamPath.endsWith(".pbf")
              ? "application/x-protobuf"
              : "application/octet-stream"),
          "Cache-Control": "public, max-age=86400",
        },
      }
    )
  } catch {
    return new Response("tile fetch failed", { status: 502 })
  }
}
