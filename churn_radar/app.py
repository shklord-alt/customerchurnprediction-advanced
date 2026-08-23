"""
Churn Radar — mission-control style customer churn app.

Architecture note (why this is different from a typical churn dashboard app):
Instead of server-rendered forms that POST and reload the page, the frontend
is a set of thin HTML shells that talk to a small JSON API over fetch().
That keeps predictions and dashboard filtering instant and "live" without a
full page reload, and keeps the Flask layer purely as a data/model service.
"""

from __future__ import annotations

import json
import os

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)

# ------------------------------------------------------------------
# Load model + metrics once at startup
# ------------------------------------------------------------------

MODEL_PATH = os.path.join(BASE_DIR, "model", "customer_churn_model.pkl")
METRICS_PATH = os.path.join(BASE_DIR, "model", "metrics_report.json")
DATASET_PATH = os.path.join(BASE_DIR, "dataset", "customer_churn_cleaned.csv")

model = joblib.load(MODEL_PATH)

with open(METRICS_PATH, "r") as f:
    metrics = json.load(f)

df = pd.read_csv(DATASET_PATH)

# Normalize column names the dashboard/API works with (snake_case)
df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

# The trained pipeline expects these exact (already-snake-cased) feature
# names — pulled straight from the training script so the two never drift.
FEATURE_ORDER = [
    "gender", "senior_citizen", "partner", "dependents", "tenure_months",
    "phone_service", "multiple_lines", "internet_service", "online_security",
    "online_backup", "device_protection", "tech_support", "streaming_tv",
    "streaming_movies", "contract", "paperless_billing", "payment_method",
    "monthly_charges", "total_charges",
]

CATEGORICAL_CHOICES = {
    col: sorted(df[col].dropna().astype(str).unique().tolist())
    for col in [
        "gender", "senior_citizen", "partner", "dependents", "phone_service",
        "multiple_lines", "internet_service", "online_security",
        "online_backup", "device_protection", "tech_support", "streaming_tv",
        "streaming_movies", "contract", "paperless_billing", "payment_method",
    ]
}

# Pre-compute global feature importances (if the trained model exposes them)
# so the predict page can explain *why*, not just spit out a number.
_feature_importance_lookup = {}
try:
    pipeline_model = model.named_steps.get("classifier") or list(model.named_steps.values())[-1]
    preprocessor = model.named_steps.get("preprocessor") or list(model.named_steps.values())[0]
    raw_names = preprocessor.get_feature_names_out()
    importances = pipeline_model.feature_importances_
    for name, imp in zip(raw_names, importances):
        clean = name.split("__")[-1]
        _feature_importance_lookup[clean] = _feature_importance_lookup.get(clean, 0.0) + float(imp)
except Exception:
    _feature_importance_lookup = {}


# ------------------------------------------------------------------
# Page routes (thin shells — data comes from the API below)
# ------------------------------------------------------------------

@app.route("/")
def home():
    return render_template("home.html")


@app.route("/predict")
def predict_page():
    return render_template(
        "predict.html",
        choices=CATEGORICAL_CHOICES,
        best_model=metrics.get("best_model", "Model"),
        roc_auc=metrics.get("test_metrics", {}).get("roc_auc"),
        accuracy=metrics.get("test_metrics", {}).get("accuracy"),
    )


@app.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html", metrics=metrics)


# ------------------------------------------------------------------
# JSON API
# ------------------------------------------------------------------

@app.route("/api/predict", methods=["POST"])
def api_predict():
    payload = request.get_json(force=True, silent=True) or {}

    missing = [f for f in FEATURE_ORDER if f not in payload or payload[f] in ("", None)]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    try:
        row = {}
        for field in FEATURE_ORDER:
            value = payload[field]
            if field in ("tenure_months",):
                value = int(value)
            elif field in ("monthly_charges", "total_charges"):
                value = float(value)
            row[field] = value
    except (TypeError, ValueError) as exc:
        return jsonify({"error": "bad_value", "detail": str(exc)}), 400

    input_df = pd.DataFrame([row], columns=FEATURE_ORDER)

    probability_churn = float(model.predict_proba(input_df)[0][1])
    prediction = int(probability_churn >= 0.5)

    if probability_churn >= 0.66:
        risk_band = "critical"
    elif probability_churn >= 0.5:
        risk_band = "elevated"
    elif probability_churn >= 0.3:
        risk_band = "watch"
    else:
        risk_band = "stable"

    # Cheap, honest "why" — flag inputs whose category is one the model
    # weighs heavily, ranked by the model's own learned importance.
    contributing_factors = []
    risk_leaning_values = {
        "contract": "Month-to-month",
        "internet_service": "Fiber optic",
        "payment_method": "Electronic check",
        "online_security": "No",
        "tech_support": "No",
        "paperless_billing": "Yes",
    }
    for field in ["contract", "internet_service", "payment_method", "online_security", "tech_support", "tenure_months", "monthly_charges"]:
        weight = 0.0
        for k, v in _feature_importance_lookup.items():
            if k.startswith(field):
                weight += v
        contributing_factors.append({
            "feature": field,
            "value": row[field],
            "weight": round(weight, 4),
            "risk_leaning": risk_leaning_values.get(field, None) == str(row[field]),
        })
    contributing_factors.sort(key=lambda x: x["weight"], reverse=True)

    return jsonify({
        "prediction": prediction,
        "label": "Likely to churn" if prediction == 1 else "Likely to stay",
        "probability_churn": round(probability_churn * 100, 2),
        "probability_stay": round((1 - probability_churn) * 100, 2),
        "risk_band": risk_band,
        "contributing_factors": contributing_factors[:5],
        "model": metrics.get("best_model", "Model"),
        "model_roc_auc": metrics.get("test_metrics", {}).get("roc_auc"),
    })


@app.route("/api/dashboard-data")
def api_dashboard_data():
    """Aggregates for the dashboard — filterable via query params."""
    filtered = df.copy()

    contract = request.args.get("contract")
    internet = request.args.get("internet_service")
    gender = request.args.get("gender")
    senior = request.args.get("senior_citizen")

    if contract and contract != "all":
        filtered = filtered[filtered["contract"] == contract]
    if internet and internet != "all":
        filtered = filtered[filtered["internet_service"] == internet]
    if gender and gender != "all":
        filtered = filtered[filtered["gender"] == gender]
    if senior and senior != "all":
        filtered = filtered[filtered["senior_citizen"] == senior]

    total = len(filtered)
    churned = int(filtered["churn"].sum()) if total else 0
    stayed = total - churned
    churn_rate = round((churned / total) * 100, 2) if total else 0.0
    avg_tenure = round(float(filtered["tenure_months"].mean()), 1) if total else 0.0
    avg_monthly = round(float(filtered["monthly_charges"].mean()), 2) if total else 0.0

    def rate_by(col: str):
        if total == 0:
            return []
        g = filtered.groupby(col)["churn"].agg(["mean", "count"]).reset_index()
        g = g.sort_values("count", ascending=False)
        return [
            {"label": str(r[col]), "churn_rate": round(float(r["mean"]) * 100, 2), "count": int(r["count"])}
            for _, r in g.iterrows()
        ]

    tenure_bins = [0, 6, 12, 24, 48, 72, 200]
    tenure_labels = ["0-6", "7-12", "13-24", "25-48", "49-72", "72+"]
    tenure_dist = []
    if total:
        binned = pd.cut(filtered["tenure_months"], bins=tenure_bins, labels=tenure_labels, right=True)
        g = filtered.groupby(binned, observed=False)["churn"].agg(["mean", "count"])
        for label in tenure_labels:
            if label in g.index:
                row = g.loc[label]
                tenure_dist.append({"label": label, "churn_rate": round(float(row["mean"]) * 100, 2) if row["count"] else 0, "count": int(row["count"])})
            else:
                tenure_dist.append({"label": label, "churn_rate": 0, "count": 0})

    return jsonify({
        "total_customers": total,
        "churned_customers": churned,
        "stayed_customers": stayed,
        "churn_rate": churn_rate,
        "avg_tenure_months": avg_tenure,
        "avg_monthly_charges": avg_monthly,
        "by_contract": rate_by("contract"),
        "by_internet_service": rate_by("internet_service"),
        "by_payment_method": rate_by("payment_method"),
        "by_tenure_bucket": tenure_dist,
        "filters": {
            "contracts": sorted(df["contract"].dropna().unique().tolist()),
            "internet_services": sorted(df["internet_service"].dropna().unique().tolist()),
            "genders": sorted(df["gender"].dropna().unique().tolist()),
            "senior_citizens": sorted(df["senior_citizen"].dropna().unique().tolist()),
        },
    })


@app.route("/api/customer-cloud")
def api_customer_cloud():
    """
    A sampled point cloud for the 3D orbit view: each customer becomes a
    point positioned by tenure / monthly charges / total charges, coloured
    by churn status. Sampled + rounded to keep the payload small.
    """
    sample_n = min(500, len(df))
    sample = df.sample(n=sample_n, random_state=7)

    def norm(series):
        lo, hi = series.min(), series.max()
        if hi == lo:
            return series * 0
        return (series - lo) / (hi - lo)

    tenure_n = norm(sample["tenure_months"])
    monthly_n = norm(sample["monthly_charges"])
    total_n = norm(sample["total_charges"])

    points = [
        {
            "x": round(float(t) * 2 - 1, 3),
            "y": round(float(m) * 2 - 1, 3),
            "z": round(float(tot) * 2 - 1, 3),
            "churn": int(c),
        }
        for t, m, tot, c in zip(tenure_n, monthly_n, total_n, sample["churn"])
    ]
    return jsonify({"points": points})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5050))
    app.run(host="0.0.0.0", port=port, debug=False)
