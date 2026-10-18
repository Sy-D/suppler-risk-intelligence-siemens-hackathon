export const riskDimensions = [
  { label: "Financial risk", key: "financial" },
  { label: "Quality risk", key: "quality" },
  { label: "Operational risk", key: "operational" },
  { label: "Compliance risk", key: "compliance" },
  { label: "ESG risk", key: "esg" },
  { label: "Digital security risk", key: "digital" },
  { label: "Governance risk", key: "governance" },
  { label: "Credit rating risk", key: "credit" },
] as const

export const riskDimensionGroups = [
  {
    label: "Financial",
    dimensions: [
      { label: "Financial health", key: "financial" },
      { label: "Credit rating", key: "credit" },
      { label: "Industry benchmark", key: "benchmark" },
    ],
  },
  {
    label: "Operational",
    dimensions: [
      { label: "Operational resilience", key: "operational" },
      { label: "Quality risk", key: "quality" },
      { label: "Labor stability", key: "labor" },
      { label: "Safety incidents", key: "safety" },
    ],
  },
  {
    label: "Compliance & ESG",
    dimensions: [
      { label: "Compliance risk", key: "compliance" },
      { label: "ESG performance", key: "esg" },
      { label: "Environmental exposure", key: "environmental" },
      { label: "Digital security", key: "digital" },
      { label: "Governance", key: "governance" },
    ],
  },
  {
    label: "Geopolitical & supply chain",
    dimensions: [
      { label: "Geopolitical risk", key: "geopolitical" },
      { label: "Political stability", key: "political" },
      { label: "External intelligence", key: "intel" },
      { label: "Sub-tier visibility", key: "subTier" },
    ],
  },
  {
    label: "Market & sentiment",
    dimensions: [
      { label: "Market sentiment", key: "market" },
      { label: "Media sentiment", key: "media" },
    ],
  },
] as const

export type DimensionKey =
  (typeof riskDimensionGroups)[number]["dimensions"][number]["key"]

export const euro = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 2,
})
