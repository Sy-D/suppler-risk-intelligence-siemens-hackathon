"""Structured output schema for supplier risk rows.

Column order and names match the agreed CSV schema exactly. The model fills in
the researchable scores; *_Level fields and Total_Risk_Index are derived in
code so they stay consistent across rows. Internal ERP fields (PO volume,
order change rate, delivery rating, confirmation rate) are left empty.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
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
    "HQ City",
    "HQ Country",
    "Website",
    "Contact Email",
    "Last Modified",
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


class ScoredDimension(BaseModel):
    """One risk dimension: a 0-100 risk score plus its justification and the
    source URLs that support it."""

    score: int = Field(ge=0, le=100)
    reason: str = ""
    sources: list[str] = Field(default_factory=list)


class CompanyProfile(BaseModel):
    """Public company facts gathered during research. All optional."""

    hq_city: str = ""
    hq_country: str = ""
    website: str = ""
    contact_email: str = ""


class SourcingRiskChoice(BaseModel):
    value: Literal["Low", "Medium", "High", "Critical"]
    reason: str = ""
    sources: list[str] = Field(default_factory=list)


class ComplexityChoice(BaseModel):
    value: Literal["Simple", "Moderate", "Complex", "Very Complex"]
    reason: str = ""
    sources: list[str] = Field(default_factory=list)


class SupplierRiskScores(BaseModel):
    """Scores produced by the model. All are 0-100 risk scores where higher
    means more risk (including for 'health'/'stability' named dimensions)."""

    industry_benchmark: ScoredDimension
    media_sentiment: ScoredDimension
    external_intelligence: ScoredDimension
    sub_tier_visibility: ScoredDimension
    labor_stability: ScoredDimension
    financial_health: ScoredDimension
    compliance_risk: ScoredDimension
    safety_incident: ScoredDimension
    environmental_exposure: ScoredDimension
    esg_performance: ScoredDimension
    digital_security: ScoredDimension
    operational_resilience: ScoredDimension
    market_sentiment: ScoredDimension
    quality_risk: ScoredDimension
    governance_risk: ScoredDimension
    geopolitical_risk: ScoredDimension
    political_stability: ScoredDimension
    credit_rating: ScoredDimension
    sourcing_risk_level: SourcingRiskChoice
    supply_chain_complexity: ComplexityChoice
    company_profile: CompanyProfile = Field(default_factory=CompanyProfile)


_PART_OVERRIDES = {"esg": "ESG"}


def _column_name(field: str) -> str:
    parts = [_PART_OVERRIDES.get(p, p.capitalize()) for p in field.split("_")]
    return "_".join(parts) + "_Score"


def build_row(supplier_id: str, name: str, scores: SupplierRiskScores) -> dict:
    """Assemble one CSV row in CSV_HEADER order from model scores."""
    row = {
        "supplierID": supplier_id,
        "Supplier Name": name,
        "Sourcing Risk Level": scores.sourcing_risk_level.value,
        "Supply Chain Complexity": scores.supply_chain_complexity.value,
    }
    total = 0
    for field in SCORE_FIELDS:
        score = getattr(scores, field).score
        col = _column_name(field)
        row[col] = score
        row[col.replace("_Score", "_Score_Level")] = level_for(score)
        total += score
    total_index = round(total / len(SCORE_FIELDS))
    row["Total_Risk_Index"] = total_index
    row["Total_Risk_Index_Level"] = level_for(total_index)
    for field in INTERNAL_FIELDS:
        row[field] = ""
    profile = scores.company_profile
    row["HQ City"] = profile.hq_city
    row["HQ Country"] = profile.hq_country
    row["Website"] = profile.website
    row["Contact Email"] = profile.contact_email
    row["Last Modified"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return {col: row[col] for col in CSV_HEADER}


def build_reasoning(row: dict, scores: SupplierRiskScores) -> dict:
    """Per-column reasoning + sources for one row, keyed by CSV column name."""
    columns: dict = {
        "supplierID": {"value": row["supplierID"], "reason": "auto-assigned sequential ID", "sources": []},
        "Supplier Name": {"value": row["Supplier Name"], "reason": "CLI input", "sources": []},
        "Total_Risk_Index": {
            "value": row["Total_Risk_Index"],
            "reason": f"mean of the {len(SCORE_FIELDS)} dimension scores",
            "sources": [],
        },
        "Total_Risk_Index_Level": {
            "value": row["Total_Risk_Index_Level"],
            "reason": f"derived from Total_Risk_Index={row['Total_Risk_Index']} via level_for()",
            "sources": [],
        },
    }
    for field in SCORE_FIELDS:
        dim = getattr(scores, field)
        col = _column_name(field)
        columns[col] = {"value": dim.score, "reason": dim.reason, "sources": dim.sources}
        columns[col.replace("_Score", "_Score_Level")] = {
            "value": level_for(dim.score),
            "reason": f"derived from {col}={dim.score} via level_for()",
            "sources": [],
        }
    for field in INTERNAL_FIELDS:
        columns[field] = {
            "value": "",
            "reason": "internal ERP data — not populated by web research",
            "sources": [],
        }
    for col, choice in (
        ("Sourcing Risk Level", scores.sourcing_risk_level),
        ("Supply Chain Complexity", scores.supply_chain_complexity),
    ):
        columns[col] = {"value": choice.value, "reason": choice.reason, "sources": choice.sources}
    columns["HQ City"] = {"value": row["HQ City"], "reason": "public company profile", "sources": []}
    columns["HQ Country"] = {"value": row["HQ Country"], "reason": "public company profile", "sources": []}
    columns["Website"] = {"value": row["Website"], "reason": "public company profile", "sources": []}
    columns["Contact Email"] = {"value": row["Contact Email"], "reason": "public company profile", "sources": []}
    columns["Last Modified"] = {
        "value": row["Last Modified"],
        "reason": "UTC timestamp written when the row was produced",
        "sources": [],
    }
    return {
        "supplierID": row["supplierID"],
        "Supplier Name": row["Supplier Name"],
        "columns": {col: columns[col] for col in CSV_HEADER},
    }


def append_jsonl(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as fh:
        fh.write(json.dumps(record) + "\n")


def next_supplier_id(path: Path) -> str:
    """Highest existing numeric suffix + 1 — never reuses a deleted id."""
    if not path.exists():
        return "SUPP_00001"
    ids = [
        int(r["supplierID"].rsplit("_", 1)[1])
        for r in csv.DictReader(path.open())
        if r["supplierID"].startswith("SUPP_")
    ]
    return f"SUPP_{(max(ids) if ids else 0) + 1:05d}"


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


def render_reasoning(reasoning: dict) -> str:
    lines = ["Reasoning & sources:"]
    for col, info in reasoning["columns"].items():
        lines.append(f"  {col} = {info['value']}")
        lines.append(f"    {info['reason']}")
        for url in info["sources"]:
            lines.append(f"    - {url}")
    return "\n".join(lines)
