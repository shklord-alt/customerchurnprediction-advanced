/**
 * Ambient background — "Customer Stream".
 *
 * An endless flythrough: points representing customers stream out of the
 * distance toward the viewer forever (classic warp-tunnel perspective,
 * continuously "zooming in"). Teal points (stayed) hold a steady course
 * down the tunnel; amber points (churned, ~26% of the stream — matching
 * the real churn rate) pick up outward drift as they approach, visibly
 * peeling away from the group. The motion itself is the metaphor: most
 * customers travel with you, a share of them drift off.
 */
(function () {
  const canvas = document.getElementById("radar-bg");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let W, H, DPR, cx, cy;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    cx = W / 2;
    cy = H / 2;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FOCAL = 260;
  const SPEED = reduceMotion ? 0 : 0.0032;
  const CHURN_RATE = 0.265;

  function spawnPoint(z) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.15 + Math.random() * 0.85;
    const churn = Math.random() < CHURN_RATE;
    return {
      baseX: Math.cos(angle) * radius,
      baseY: Math.sin(angle) * radius,
      driftAngle: angle + (Math.random() - 0.5) * 0.6,
      z: z !== undefined ? z : Math.random(),
      churn,
      trailX: null,
      trailY: null,
    };
  }

  const COUNT = Math.max(90, Math.min(220, Math.floor((W * H) / 9000)));
  const points = Array.from({ length: COUNT }, () => spawnPoint());

  // Expanding rings reinforce the "zooming in, endlessly" read.
  const rings = [0, 0.33, 0.66];

  function draw() {
    ctx.fillStyle = "rgba(5,7,12,0.34)"; // trail fade instead of hard clear -> motion streaks
    ctx.fillRect(0, 0, W, H);

    // expanding concentric rings, looping
    rings.forEach((offset, i) => {
      rings[i] = (offset + (reduceMotion ? 0 : 0.0016)) % 1;
      const t = rings[i];
      const r = t * Math.hypot(W, H) * 0.6;
      const alpha = (1 - t) * 0.06;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(51,230,201,${alpha})`;
      ctx.lineWidth = 1;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    points.forEach((p) => {
      p.z -= SPEED;
      if (p.z <= 0.02) {
        Object.assign(p, spawnPoint(1));
        p.trailX = null;
        p.trailY = null;
      }

      // churned points drift outward from their base course as they near camera
      const approach = 1 - p.z; // 0 far -> 1 near
      const drift = p.churn ? approach * approach * 0.9 : 0;
      const x = p.baseX + Math.cos(p.driftAngle) * drift;
      const y = p.baseY + Math.sin(p.driftAngle) * drift;

      const scale = FOCAL / (p.z * FOCAL + 40);
      const sx = cx + x * FOCAL * scale;
      const sy = cy + y * FOCAL * scale;
      const size = Math.max(0.4, scale * (p.churn ? 1.6 : 1.2));

      if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) {
        p.trailX = null; p.trailY = null;
        return;
      }

      const color = p.churn ? "255,138,61" : "51,230,201";
      const alpha = Math.min(0.85, 0.15 + approach * 0.8);

      if (p.trailX !== null) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${color}, ${alpha * 0.5})`;
        ctx.lineWidth = size * 0.8;
        ctx.moveTo(p.trailX, p.trailY);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.fillStyle = `rgba(${color}, ${alpha})`;
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();

      p.trailX = sx;
      p.trailY = sy;
    });

    requestAnimationFrame(draw);
  }

  // start on a dark-filled canvas so trails have something to fade from
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, W, H);
  requestAnimationFrame(draw);
})();
