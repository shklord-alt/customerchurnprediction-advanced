(function () {
  const els = {
    contract: document.getElementById("filter-contract"),
    internet: document.getElementById("filter-internet"),
    gender: document.getElementById("filter-gender"),
    senior: document.getElementById("filter-senior"),
    reset: document.getElementById("filter-reset"),
    total: document.getElementById("kpi-total"),
    rate: document.getElementById("kpi-rate"),
    tenure: document.getElementById("kpi-tenure"),
    monthly: document.getElementById("kpi-monthly"),
  };

  const CHART_COLORS = { risk: "#ff8a3d", safe: "#33e6c9", grid: "#1b2536", text: "#8593ac" };
  Chart.defaults.color = CHART_COLORS.text;
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";
  Chart.defaults.font.size = 11;

  let filtersPopulated = false;
  let tenureChart, splitChart, contractChart, paymentChart;

  function populateSelect(select, values, current) {
    const existing = new Set(Array.from(select.options).map((o) => o.value));
    values.forEach((v) => {
      if (!existing.has(v)) {
        const opt = document.createElement("option");
        opt.value = v; opt.textContent = v;
        select.appendChild(opt);
      }
    });
  }

  function buildQuery() {
    const params = new URLSearchParams();
    if (els.contract.value !== "all") params.set("contract", els.contract.value);
    if (els.internet.value !== "all") params.set("internet_service", els.internet.value);
    if (els.gender.value !== "all") params.set("gender", els.gender.value);
    if (els.senior.value !== "all") params.set("senior_citizen", els.senior.value);
    return params.toString();
  }

  function barOptions(suffix) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: CHART_COLORS.grid } },
        y: { grid: { color: CHART_COLORS.grid }, ticks: { callback: (v) => v + (suffix || "") } },
      },
    };
  }

  async function refresh() {
    const qs = buildQuery();
    const res = await fetch("/api/dashboard-data" + (qs ? "?" + qs : ""));
    const d = await res.json();

    if (!filtersPopulated) {
      populateSelect(els.contract, d.filters.contracts);
      populateSelect(els.internet, d.filters.internet_services);
      populateSelect(els.gender, d.filters.genders);
      populateSelect(els.senior, d.filters.senior_citizens);
      filtersPopulated = true;
    }

    els.total.textContent = d.total_customers.toLocaleString();
    els.rate.textContent = d.churn_rate + "%";
    els.tenure.textContent = d.avg_tenure_months + " mo";
    els.monthly.textContent = "$" + d.avg_monthly_charges;

    const tenureLabels = d.by_tenure_bucket.map((r) => r.label + " mo");
    const tenureRates = d.by_tenure_bucket.map((r) => r.churn_rate);

    const contractLabels = d.by_contract.map((r) => r.label);
    const contractRates = d.by_contract.map((r) => r.churn_rate);

    const paymentLabels = d.by_payment_method.map((r) => r.label);
    const paymentRates = d.by_payment_method.map((r) => r.churn_rate);

    if (!tenureChart) {
      tenureChart = new Chart(document.getElementById("chart-tenure"), {
        type: "bar",
        data: { labels: tenureLabels, datasets: [{ data: tenureRates, backgroundColor: CHART_COLORS.risk, borderRadius: 6, maxBarThickness: 34 }] },
        options: barOptions("%"),
      });
      splitChart = new Chart(document.getElementById("chart-split"), {
        type: "doughnut",
        data: {
          labels: ["Stayed", "Churned"],
          datasets: [{ data: [d.stayed_customers, d.churned_customers], backgroundColor: [CHART_COLORS.safe, CHART_COLORS.risk], borderWidth: 0 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } } } },
      });
      contractChart = new Chart(document.getElementById("chart-contract"), {
        type: "bar",
        data: { labels: contractLabels, datasets: [{ data: contractRates, backgroundColor: CHART_COLORS.safe, borderRadius: 6, maxBarThickness: 40 }] },
        options: { ...barOptions("%"), indexAxis: "y" },
      });
      paymentChart = new Chart(document.getElementById("chart-payment"), {
        type: "bar",
        data: { labels: paymentLabels, datasets: [{ data: paymentRates, backgroundColor: CHART_COLORS.risk, borderRadius: 6, maxBarThickness: 40 }] },
        options: { ...barOptions("%"), indexAxis: "y" },
      });
    } else {
      tenureChart.data.labels = tenureLabels; tenureChart.data.datasets[0].data = tenureRates; tenureChart.update();
      splitChart.data.datasets[0].data = [d.stayed_customers, d.churned_customers]; splitChart.update();
      contractChart.data.labels = contractLabels; contractChart.data.datasets[0].data = contractRates; contractChart.update();
      paymentChart.data.labels = paymentLabels; paymentChart.data.datasets[0].data = paymentRates; paymentChart.update();
    }
  }

  [els.contract, els.internet, els.gender, els.senior].forEach((el) => el.addEventListener("change", refresh));
  els.reset.addEventListener("click", () => {
    [els.contract, els.internet, els.gender, els.senior].forEach((el) => (el.value = "all"));
    refresh();
  });

  refresh();
})();
