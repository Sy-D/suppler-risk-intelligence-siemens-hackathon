export type HazardKind = "earthquake" | "flood" | "cyclone" | "tsunami"

export interface GeoRegion {
  name: string
  country: string
  lat: number
  lon: number
  /** 0 none, 1 low, 2 medium, 3 high */
  hazards: Record<HazardKind, number>
  /** Hazard-season months (0 = January). */
  season: number[]
  seasonLabel: string
  /** Selection weight for the synthetic dataset. */
  weight: number
}

const REGIONS: GeoRegion[] = [
  { name: "Stuttgart", country: "Germany", lat: 48.78, lon: 9.18, hazards: { earthquake: 0, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 10 },
  { name: "Munich", country: "Germany", lat: 48.14, lon: 11.58, hazards: { earthquake: 0, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 8 },
  { name: "Ruhr area", country: "Germany", lat: 51.48, lon: 7.22, hazards: { earthquake: 0, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 6 },
  { name: "Katowice", country: "Poland", lat: 50.26, lon: 19.02, hazards: { earthquake: 0, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 4 },
  { name: "Brno", country: "Czechia", lat: 49.2, lon: 16.6, hazards: { earthquake: 0, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 3 },
  { name: "Lyon", country: "France", lat: 45.76, lon: 4.84, hazards: { earthquake: 0, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 3 },
  { name: "Turin", country: "Italy", lat: 45.07, lon: 7.69, hazards: { earthquake: 1, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 3 },
  { name: "Gothenburg", country: "Sweden", lat: 57.71, lon: 11.97, hazards: { earthquake: 0, flood: 0, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 2 },
  { name: "Budapest", country: "Hungary", lat: 47.5, lon: 19.04, hazards: { earthquake: 1, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 2 },
  { name: "Istanbul", country: "Türkiye", lat: 41.01, lon: 28.98, hazards: { earthquake: 3, flood: 1, cyclone: 0, tsunami: 1 }, season: [], seasonLabel: "Earthquake risk year-round", weight: 3 },
  { name: "Midlands", country: "United Kingdom", lat: 52.48, lon: -1.89, hazards: { earthquake: 0, flood: 1, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 3 },
  { name: "US Midwest", country: "United States", lat: 41.88, lon: -87.63, hazards: { earthquake: 0, flood: 1, cyclone: 1, tsunami: 0 }, season: [3, 4, 5], seasonLabel: "Tornado season Apr–Jun", weight: 8 },
  { name: "US South", country: "United States", lat: 29.76, lon: -95.37, hazards: { earthquake: 0, flood: 2, cyclone: 2, tsunami: 0 }, season: [5, 6, 7, 8, 9], seasonLabel: "Hurricane season Jun–Oct", weight: 5 },
  { name: "California", country: "United States", lat: 37.34, lon: -121.89, hazards: { earthquake: 3, flood: 1, cyclone: 0, tsunami: 1 }, season: [], seasonLabel: "Earthquake risk year-round", weight: 5 },
  { name: "Pacific Northwest", country: "United States", lat: 47.61, lon: -122.33, hazards: { earthquake: 2, flood: 1, cyclone: 0, tsunami: 2 }, season: [], seasonLabel: "Cascadia quake/tsunami exposure", weight: 3 },
  { name: "Ontario", country: "Canada", lat: 43.65, lon: -79.38, hazards: { earthquake: 0, flood: 0, cyclone: 0, tsunami: 0 }, season: [], seasonLabel: "No major seasonal hazard", weight: 3 },
  { name: "Monterrey", country: "Mexico", lat: 25.69, lon: -100.32, hazards: { earthquake: 1, flood: 1, cyclone: 1, tsunami: 0 }, season: [5, 6, 7, 8, 9], seasonLabel: "Hurricane season Jun–Oct", weight: 4 },
  { name: "São Paulo", country: "Brazil", lat: -23.55, lon: -46.63, hazards: { earthquake: 0, flood: 2, cyclone: 0, tsunami: 0 }, season: [10, 11, 0, 1, 2], seasonLabel: "Heavy-rain season Nov–Mar", weight: 3 },
  { name: "Shenzhen", country: "China", lat: 22.54, lon: 114.06, hazards: { earthquake: 1, flood: 2, cyclone: 2, tsunami: 0 }, season: [4, 5, 6, 7, 8, 9], seasonLabel: "Typhoon season May–Oct", weight: 9 },
  { name: "Suzhou", country: "China", lat: 31.3, lon: 120.62, hazards: { earthquake: 1, flood: 2, cyclone: 1, tsunami: 0 }, season: [5, 6, 7], seasonLabel: "Plum-rain season Jun–Aug", weight: 7 },
  { name: "Chongqing", country: "China", lat: 29.56, lon: 106.55, hazards: { earthquake: 1, flood: 2, cyclone: 0, tsunami: 0 }, season: [5, 6, 7], seasonLabel: "Yangtze flood season Jun–Aug", weight: 4 },
  { name: "Taiwan", country: "Taiwan", lat: 24.15, lon: 120.67, hazards: { earthquake: 3, flood: 1, cyclone: 3, tsunami: 2 }, season: [6, 7, 8, 9], seasonLabel: "Typhoon season Jul–Oct", weight: 6 },
  { name: "Kanto", country: "Japan", lat: 35.68, lon: 139.69, hazards: { earthquake: 3, flood: 1, cyclone: 2, tsunami: 3 }, season: [7, 8, 9], seasonLabel: "Typhoon season Aug–Oct", weight: 5 },
  { name: "Aichi", country: "Japan", lat: 35.18, lon: 136.91, hazards: { earthquake: 2, flood: 1, cyclone: 2, tsunami: 2 }, season: [7, 8, 9], seasonLabel: "Typhoon season Aug–Oct", weight: 3 },
  { name: "Gyeonggi", country: "South Korea", lat: 37.41, lon: 127.52, hazards: { earthquake: 1, flood: 1, cyclone: 1, tsunami: 0 }, season: [6, 7], seasonLabel: "Monsoon season Jul–Aug", weight: 4 },
  { name: "Chennai", country: "India", lat: 13.08, lon: 80.27, hazards: { earthquake: 1, flood: 2, cyclone: 2, tsunami: 1 }, season: [9, 10, 11], seasonLabel: "NE monsoon Oct–Dec", weight: 4 },
  { name: "Pune", country: "India", lat: 18.52, lon: 73.86, hazards: { earthquake: 1, flood: 1, cyclone: 1, tsunami: 0 }, season: [5, 6, 7, 8], seasonLabel: "Monsoon season Jun–Sep", weight: 4 },
  { name: "Rayong", country: "Thailand", lat: 12.68, lon: 101.28, hazards: { earthquake: 0, flood: 2, cyclone: 1, tsunami: 1 }, season: [4, 5, 6, 7, 8, 9], seasonLabel: "Flood season May–Oct", weight: 3 },
  { name: "Ho Chi Minh", country: "Vietnam", lat: 10.82, lon: 106.63, hazards: { earthquake: 0, flood: 2, cyclone: 2, tsunami: 0 }, season: [4, 5, 6, 7, 8, 9], seasonLabel: "Monsoon/typhoon season May–Oct", weight: 3 },
  { name: "Penang", country: "Malaysia", lat: 5.41, lon: 100.33, hazards: { earthquake: 1, flood: 1, cyclone: 0, tsunami: 1 }, season: [3, 4, 8, 9, 10], seasonLabel: "Rainy season Apr–May, Sep–Nov", weight: 2 },
  { name: "Batam", country: "Indonesia", lat: 1.13, lon: 104.05, hazards: { earthquake: 2, flood: 1, cyclone: 0, tsunami: 2 }, season: [], seasonLabel: "Earthquake/tsunami exposure", weight: 2 },
]

const totalWeight = REGIONS.reduce((sum, r) => sum + r.weight, 0)

function hashId(id: string) {
  let hash = 2166136261
  for (const char of id) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function regionForSupplier(id: string): GeoRegion {
  let pick = hashId(id) % totalWeight
  for (const region of REGIONS) {
    if (pick < region.weight) return region
    pick -= region.weight
  }
  return REGIONS[0]
}

/** Deterministic jitter so suppliers in one region don't stack on one dot. */
export function coordinatesForSupplier(id: string) {
  const region = regionForSupplier(id)
  const hash = hashId(`${id}:coords`)
  const lat = region.lat + (((hash >> 8) % 1000) / 1000 - 0.5) * 0.8
  const lon = region.lon + (((hash >> 20) % 1000) / 1000 - 0.5) * 0.8
  return { lat, lon }
}

export const HAZARD_META = {
  earthquake: { label: "Earthquake", color: "#f97316" },
  flood: { label: "Flood", color: "#38bdf8" },
  cyclone: { label: "Cyclone / storm", color: "#a78bfa" },
  tsunami: { label: "Tsunami", color: "#34d399" },
} satisfies Record<HazardKind, { label: string; color: string }>
