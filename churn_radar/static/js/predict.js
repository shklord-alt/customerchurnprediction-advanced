(function () {
  const form = document.getElementById("predict-form");
  const scanBtn = document.getElementById("scan-btn");
  const status = document.getElementById("scan-status");
  const resultCard = document.getElementById("result-card");
  const band = document.getElementById("result-band");
  const headline = document.getElementById("result-headline");
  const gaugeFill = document.getElementById("gauge-fill");
  const gaugeValue = document.getElementById("gauge-value");
  const factorList = document.getElementById("factor-list");

  const BAND_COPY = {
    stable: "STABLE",
    watch: "WATCH",
    elevated: "ELEVATED RISK",
    critical: "CRITICAL RISK",
  };
  const BAND_COLOR = {
    stable: "var(--safe)",
    watch: "#ffd23f",
    elevated: "var(--risk)",
    critical: "var(--risk)",
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    scanBtn.disabled = true;
    status.textContent = "Scanning…";

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "scan_failed");
      renderResult(json);
      status.textContent = "";
    } catch (err) {
      status.textContent = "Scan failed — check the fields and try again.";
    } finally {
      scanBtn.disabled = false;
    }
  });

  function renderResult(r) {
    resultCard.classList.add("is-visible");
    band.className = "result-band " + r.risk_band;
    band.textContent = BAND_COPY[r.risk_band] || r.risk_band;
    headline.textContent = r.label + ` (${r.probability_churn}% churn probability)`;

    const color = BAND_COLOR[r.risk_band] || "var(--safe)";
    gaugeFill.style.width = r.probability_churn + "%";
    gaugeFill.style.background = color;
    gaugeValue.textContent = r.probability_churn + "%";

    factorList.innerHTML = "";
    r.contributing_factors.forEach((f) => {
      const row = document.createElement("div");
      row.className = "factor-row";
      const pct = Math.min(100, Math.round(f.weight * 400));
      row.innerHTML = `
        <span class="factor-name">${f.feature.replace(/_/g, " ")}: <b>${f.value}</b></span>
        <span style="font-family:var(--font-mono); font-size:11px; color:${f.risk_leaning ? 'var(--risk)' : 'var(--text-faint)'}">${f.risk_leaning ? "raises risk" : "neutral"}</span>
        <div class="factor-bar-track"><div class="factor-bar-fill ${f.risk_leaning ? 'flag' : ''}" style="width:${pct}%"></div></div>
      `;
      factorList.appendChild(row);
    });

    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
})();
