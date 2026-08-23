/**
 * Radar Guide — the site's help center.
 *
 * First-time visitors (no localStorage flag): a short spotlight tour
 * auto-launches, walking through the two main routes and the guide
 * itself. A "Skip — I already know this" button is always visible so
 * anyone who recognizes the product (e.g. on a new device) can bail
 * immediately. Returning visitors just get the floating guide icon —
 * no auto tour — and can replay it anytime from the panel.
 *
 * The chat panel itself is a small rule-based responder (keyword
 * matched against a fixed FAQ) rather than a live model call — it's
 * labelled as a guide, not presented as a general-purpose AI, so
 * expectations stay honest.
 */
(function () {
  const STORAGE_KEY = "churnradar_visited_v1";

  const launcher = document.getElementById("help-launcher");
  const panel = document.getElementById("help-panel");
  const closeBtn = document.getElementById("help-close");
  const messages = document.getElementById("help-messages");
  const quickReplies = document.getElementById("help-quick-replies");
  const form = document.getElementById("help-form");
  const input = document.getElementById("help-input");
  const restartTourBtn = document.getElementById("help-restart-tour");

  const overlay = document.getElementById("tour-overlay");
  const spotlight = document.getElementById("tour-spotlight");
  const card = document.getElementById("tour-card");
  const stepCountEl = document.getElementById("tour-step-count");
  const titleEl = document.getElementById("tour-title");
  const bodyEl = document.getElementById("tour-body");
  const nextBtn = document.getElementById("tour-next");
  const skipBtn = document.getElementById("tour-skip");

  // ---------------------------------------------------------------
  // Guided tour
  // ---------------------------------------------------------------
  const steps = [
    {
      selector: ".brand",
      title: "Welcome to Churn Radar",
      body: "This deck helps you spot customers likely to leave, and see the bigger churn picture across your base. Four quick stops.",
    },
    {
      selector: '.topnav a[href="/predict"]',
      title: "Scan a customer",
      body: "Enter one customer's details and get an instant churn probability, risk band, and the factors driving it.",
    },
    {
      selector: '.topnav a[href="/dashboard"]',
      title: "Open the Ops Dashboard",
      body: "Filter the whole customer base by contract, service, or demographic and watch churn rate update live.",
    },
    {
      selector: "#help-launcher",
      title: "The guide is always here",
      body: "Click this any time for quick answers, or to replay this tour.",
    },
  ];

  let stepIndex = 0;

  function placeSpotlight(el) {
    if (!el) { overlay.hidden = true; return; }
    const r = el.getBoundingClientRect();
    const pad = 10;
    spotlight.style.top = (r.top - pad) + "px";
    spotlight.style.left = (r.left - pad) + "px";
    spotlight.style.width = (r.width + pad * 2) + "px";
    spotlight.style.height = (r.height + pad * 2) + "px";

    const cardTop = Math.min(window.innerHeight - 220, r.bottom + 16);
    let cardLeft = r.left;
    if (cardLeft + 300 > window.innerWidth - 20) cardLeft = window.innerWidth - 320;
    if (cardLeft < 20) cardLeft = 20;
    card.style.top = Math.max(20, cardTop) + "px";
    card.style.left = cardLeft + "px";
  }

  function renderStep() {
    const step = steps[stepIndex];
    const el = document.querySelector(step.selector);
    stepCountEl.textContent = `${stepIndex + 1} / ${steps.length}`;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    nextBtn.textContent = stepIndex === steps.length - 1 ? "Done" : "Next";
    placeSpotlight(el);
  }

  function startTour() {
    overlay.hidden = false;
    stepIndex = 0;
    renderStep();
  }

  function endTour() {
    overlay.hidden = true;
    localStorage.setItem(STORAGE_KEY, "1");
  }

  nextBtn.addEventListener("click", () => {
    if (stepIndex < steps.length - 1) {
      stepIndex += 1;
      renderStep();
    } else {
      endTour();
    }
  });
  skipBtn.addEventListener("click", endTour);
  window.addEventListener("resize", () => { if (!overlay.hidden) renderStep(); });

  const hasVisited = localStorage.getItem(STORAGE_KEY);
  if (!hasVisited) {
    setTimeout(startTour, 700);
  }

  restartTourBtn.addEventListener("click", () => {
    panel.hidden = true;
    startTour();
  });

  // ---------------------------------------------------------------
  // Help launcher + panel
  // ---------------------------------------------------------------
  function openPanel() {
    panel.hidden = false;
    if (!messages.dataset.greeted) {
      addMessage("bot", "Hi — I'm the Radar Guide. Ask me about scanning a customer, reading the dashboard, or how the model works.");
      messages.dataset.greeted = "1";
      renderQuickReplies();
    }
    input.focus();
  }
  function closePanel() { panel.hidden = true; }

  launcher.addEventListener("click", openPanel);
  launcher.addEventListener("keypress", (e) => { if (e.key === "Enter") openPanel(); });
  closeBtn.addEventListener("click", closePanel);

  function addMessage(role, text) {
    const div = document.createElement("div");
    div.className = "help-msg " + role;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // ---------------------------------------------------------------
  // Rule-based guide responses
  // ---------------------------------------------------------------
  const FAQ = [
    {
      keys: ["scan", "predict", "prediction", "how do i check", "risk score"],
      answer: "Go to Scan in the nav, fill in a customer's plan and account details, and hit Run Scan. You'll get a churn probability, a risk band (stable → critical), and the top factors pushing that number up or down.",
    },
    {
      keys: ["dashboard", "ops", "filter", "chart", "overview"],
      answer: "Ops Dashboard shows churn rate, average tenure, and breakdowns by contract, internet service, and payment method for your whole customer base. Use the filter bar at the top — every chart updates instantly.",
    },
    {
      keys: ["accurate", "accuracy", "model", "how good", "trust", "confidence"],
      answer: "Predictions come from a Gradient Boosting model validated with cross-validation and a held-out test set. Exact accuracy and ROC-AUC are shown on the Scan and Dashboard pages so you can judge confidence for yourself — no model is 100% certain.",
    },
    {
      keys: ["3d", "orbit", "model view", "rotate", "zoom"],
      answer: "The 3D view on the Scan page plots a sample of real customers by tenure, monthly charges, and total charges. Drag to rotate, scroll to zoom, right-click drag to pan. Amber points churned, teal points stayed.",
    },
    {
      keys: ["data", "dataset", "source"],
      answer: "The model and dashboard are both built on the IBM Telco Customer Churn dataset — about 7,000 real (anonymized) telecom customers.",
    },
    {
      keys: ["tour", "guide me", "walkthrough", "start over"],
      answer: "Sure — click \"Restart guided tour\" below the chat any time.",
    },
  ];

  function respondTo(text) {
    const lower = text.toLowerCase();
    const hit = FAQ.find((item) => item.keys.some((k) => lower.includes(k)));
    if (hit) return hit.answer;
    return "I'm a simple guide, not a general chatbot — I can help with scanning a customer, reading the dashboard, the 3D view, or how accurate the model is. Try asking about one of those.";
  }

  function renderQuickReplies() {
    quickReplies.innerHTML = "";
    ["How do I scan a customer?", "What does the dashboard show?", "How accurate is the model?"].forEach((q) => {
      const b = document.createElement("button");
      b.className = "qr-btn";
      b.type = "button";
      b.textContent = q;
      b.addEventListener("click", () => {
        addMessage("user", q);
        setTimeout(() => addMessage("bot", respondTo(q)), 260);
      });
      quickReplies.appendChild(b);
    });
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMessage("user", text);
    input.value = "";
    setTimeout(() => addMessage("bot", respondTo(text)), 300);
  });
})();
