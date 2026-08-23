# Churn Radar

A mission-control style customer churn app — same underlying dataset and
trained model as a typical churn project, but built as a different
experience end to end:

- **Architecture**: Flask serves a thin HTML shell per page plus a small
  JSON API (`/api/predict`, `/api/dashboard-data`, `/api/customer-cloud`).
  The frontend is vanilla JS calling that API with `fetch()` — predictions
  and dashboard filtering happen live, with no page reload.
- **Look**: dark "radar console" theme — a continuously-animated 2D canvas
  radar sweep in the background (not a particle network), a duality palette
  (amber = risk signal, teal = stable signal) instead of one flat accent,
  Space Grotesk / IBM Plex type.
- **3D**: a hand-rolled orbit-controlled Three.js point cloud on the Scan
  page — 500 sampled real customers plotted by tenure / monthly charges /
  total charges, colour-coded by churn outcome. Drag to rotate, scroll to
  zoom, right-drag to pan.
- **Prediction**: reuses the trained Gradient Boosting pipeline
  (`model/customer_churn_model.pkl`, test ROC-AUC ≈ 0.854) trained on the
  IBM Telco Customer Churn dataset. Each scan also surfaces the top factors
  behind the score, using the model's own learned feature importances.
- **AI Help Center ("Radar Guide")**: first-time visitors get an auto-launched
  spotlight tour (with an always-visible "Skip — I already know this"
  button); returning visitors (tracked via `localStorage`) just see the
  floating guide icon. The chat panel is a small rule-based FAQ responder,
  labelled as a guide rather than a general AI, so it doesn't overpromise.

## Run it

```bash
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5050`.

## Project layout

```
app.py                     Flask app + JSON API
model/                     trained pipeline + metrics report
dataset/                   cleaned Telco churn dataset (for the dashboard)
templates/                 base.html, home.html, predict.html, dashboard.html
static/css/main.css        design system
static/js/radar-bg.js      animated radar-sweep background
static/js/orbit3d.js       interactive 3D customer point cloud
static/js/predict.js       live scan form (fetch, no reload)
static/js/dashboard.js     live filters + Chart.js charts
static/js/help-center.js   guided tour + rule-based help chat
```
