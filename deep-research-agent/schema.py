"""Structured output schema for supplier risk rows.

Column order and names match the agreed CSV schema exactly. The model fills in
the researchable scores; *_Level fields and Total_Risk_Index are derived in
code so they stay consistent across rows. Internal ERP fields (PO volume,
order change rate, delivery rating, confirmation rate) are left empty.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

SCORE_FIELDS = [
    "industry_benchmark",
    "media_sentiment",
    "external_intelligence",
    "sub_tier_visibility",
    "labor_stability",
    "financial_health",
    "compliance_risk",
    "safety_incident",
    "environmental_exposure",
    "esg_performance",
    "digital_security",
    "operational_resilience",
    "market_sentiment",
    "quality_risk",
    "governance_risk",
    "geopolitical_risk",
    "political_stability",
    "credit_rating",
]

CSV_HEADER = [
    "supplierID",
    "Supplier Name",
    "Total_Risk_Index",
    "Total_Risk_Index_Level",
    "Industry_Benchmark_Score",
    "Industry_Benchmark_Score_Level",
    "Media_Sentiment_Score",
    "Media_Sentiment_Score_Level",
    "External_Intelligence_Score",
    "External_Intelligence_Score_Level",
    "Sub_Tier_Visibility_Score",
    "Sub_Tier_Visibility_Score_Level",
    "Labor_Stability_Score",
    "Labor_Stability_Score_Level",
    "Financial_Health_Score",
    "Financial_Health_Score_Level",
    "Compliance_Risk_Score",
    "Compliance_Risk_Score_Level",
    "Safety_Incident_Score",
    "Safety_Incident_Score_Level",
    "Environmental_Exposure_Score",
    "Environmental_Exposure_Score_Level",
    "ESG_Performance_Score",
    "ESG_Performance_Score_Level",
    "Digital_Security_Score",
    "Digital_Security_Score_Level",
    "Operational_Resilience_Score",
    "Operational_Resilience_Score_Level",
    "Market_Sentiment_Score",
    "Market_Sentiment_Score_Level",
    "Quality_Risk_Score",
    "Quality_Risk_Score_Level",
    "Governance_Risk_Score",
    "Governance_Risk_Score_Level",
    "Geopolitical_Risk_Score",
    "Geopolitical_Risk_Score_Level",
    "Political_Stability_Score",
    "Political_Stability_Score_Level",
    "Credit_Rating_Score",
    "Credit_Rating_Score_Level",
    "Purchase Order Volume (EUR)",
    "Order Change Rate",
    "Supplier Delivery Rating",
    "Order Confirmation Rate",
    "Sourcing Risk Level",
    "Supply Chain Complexity",
]

INTERNAL_FIELDS = [
    "Purchase Order Volume (EUR)",
    "Order Change Rate",
    "Supplier Delivery Rating",
    "Order Confirmation Rate",
]


def level_for(score: int) -> str:
    if score < 25:
        return "Low"
    if score < 50:
        return "Medium"
    if score < 75:
        return "High"
    return "Critical"


class SupplierRiskScores(BaseModel):
    """Scores produced by the model. All are 0-100 risk scores where higher
    means more risk (including for 'health'/'stability' named dimensions)."""

    industry_benchmark: int = Field(ge=0, le=100)
    media_sentiment: int = Field(ge=0, le=100)
    external_intelligence: int = Field(ge=0, le=100)
    sub_tier_visibility: int = Field(ge=0, le=100)
    labor_stability: int = Field(ge=0, le=100)
    financial_health: int = Field(ge=0, le=100)
    compliance_risk: int = Field(ge=0, le=100)
    safety_incident: int = Field(ge=0, le=100)
    environmental_exposure: int = Field(ge=0, le=100)
    esg_performance: int = Field(ge=0, le=100)
    digital_security: int = Field(ge=0, le=100)
    operational_resilience: int = Field(ge=0, le=100)
    market_sentiment: int = Field(ge=0, le=100)
    quality_risk: int = Field(ge=0, le=100)
    governance_risk: int = Field(ge=0, le=100)
    geopolitical_risk: int = Field(ge=0, le=100)
    political_stability: int = Field(ge=0, le=100)
    credit_rating: int = Field(ge=0, le=100)
    sourcing_risk_level: Literal["Low", "Medium", "High", "Critical"]
    supply_chain_complexity: Literal["Simple", "Moderate", "Complex", "Very Complex"]


_PART_OVERRIDES = {"esg": "ESG"}


def _column_name(field: str) -> str:
    parts = [_PART_OVERRIDES.get(p, p.capitalize()) for p in field.split("_")]
    return "_".join(parts) + "_Score"


def build_row(supplier_id: str, name: str, scores: SupplierRiskScores) -> dict:
    """Assemble one CSV row in CSV_HEADER order from model scores."""
    row = {
        "supplierID": supplier_id,
        "Supplier Name": name,
        "Sourcing Risk Level": scores.sourcing_risk_level,
        "Supply Chain Complexity": scores.supply_chain_complexity,
    }
    total = 0
    for field in SCORE_FIELDS:
        score = getattr(scores, field)
        col = _column_name(field)
        row[col] = score
        row[col.replace("_Score", "_Score_Level")] = level_for(score)
        total += score
    total_index = round(total / len(SCORE_FIELDS))
    row["Total_Risk_Index"] = total_index
    row["Total_Risk_Index_Level"] = level_for(total_index)
    for field in INTERNAL_FIELDS:
        row[field] = ""
    return {col: row[col] for col in CSV_HEADER}


def next_supplier_id(path: Path) -> str:
    existing = sum(1 for _ in path.open()) - 1 if path.exists() else 0
    return f"SUPP_{max(existing, 0) + 1:05d}"


def append_csv(path: Path, row: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    write_header = not path.exists() or path.stat().st_size == 0
    with path.open("a", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_HEADER)
        if write_header:
            writer.writeheader()
        writer.writerow(row)


def render_table(row: dict) -> str:
    width = max(len(col) for col in CSV_HEADER)
    lines = [f"{'Column':<{width}} | Value", f"{'-' * width}-|-{'-' * 20}"]
    for col in CSV_HEADER:
        lines.append(f"{col:<{width}} | {row[col]}")
    return "\n".join(lines)
