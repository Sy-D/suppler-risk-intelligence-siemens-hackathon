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
      {
        label: "Financial health",
        key: "financial",
        description:
          "Balance-sheet strength, liquidity and solvency of the supplier.",
      },
      {
        label: "Credit rating",
        key: "credit",
        description:
          "External credit-worthiness — the likelihood of defaulting on obligations.",
      },
      {
        label: "Industry benchmark",
        key: "benchmark",
        description:
          "Performance relative to industry peers — higher means lagging behind.",
      },
    ],
  },
  {
    label: "Operational",
    dimensions: [
      {
        label: "Operational resilience",
        key: "operational",
        description:
          "Ability to absorb disruptions and keep delivering on schedule.",
      },
      {
        label: "Quality risk",
        key: "quality",
        description: "Defect rates, recalls and process maturity.",
      },
      {
        label: "Labor stability",
        key: "labor",
        description:
          "Workforce availability, attrition and strike exposure.",
      },
      {
        label: "Safety incidents",
        key: "safety",
        description: "Accident frequency and workplace-safety record.",
      },
    ],
  },
  {
    label: "Compliance & ESG",
    dimensions: [
      {
        label: "Compliance risk",
        key: "compliance",
        description:
          "Regulatory violations, sanctions and audit findings.",
      },
      {
        label: "ESG performance",
        key: "esg",
        description:
          "Environmental, social and governance practices — higher means weaker.",
      },
      {
        label: "Environmental exposure",
        key: "environmental",
        description:
          "Exposure to climate events and environmental liabilities.",
      },
      {
        label: "Digital security",
        key: "digital",
        description: "Cybersecurity posture and data-breach exposure.",
      },
      {
        label: "Governance",
        key: "governance",
        description: "Management quality, ownership structure and conduct.",
      },
    ],
  },
  {
    label: "Geopolitical & supply chain",
    dimensions: [
      {
        label: "Geopolitical risk",
        key: "geopolitical",
        description:
          "Trade restrictions, conflicts and sanctions affecting supply.",
      },
      {
        label: "Political stability",
        key: "political",
        description: "Government stability in the supplier's home region.",
      },
      {
        label: "External intelligence",
        key: "intel",
        description:
          "Signals from news, watchlists and external intelligence feeds.",
      },
      {
        label: "Sub-tier visibility",
        key: "subTier",
        description:
          "Transparency into tier-2+ suppliers and hidden dependencies.",
      },
    ],
  },
  {
    label: "Market & sentiment",
    dimensions: [
      {
        label: "Market sentiment",
        key: "market",
        description: "Analyst and market perception of the supplier.",
      },
      {
        label: "Media sentiment",
        key: "media",
        description: "Tone of recent news coverage — higher means more negative.",
      },
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
