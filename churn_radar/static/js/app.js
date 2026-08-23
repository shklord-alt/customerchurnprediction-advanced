/**
 * Small shared UI behaviors — kept framework-free on purpose.
 * "Live" buttons: a short ripple pulse on click/tap so every primary
 * action on a dark console feels responsive, not static.
 */
(function () {
  function attachRipple(btn) {
    btn.addEventListener("click", (e) => {
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height) * 1.4;
      ripple.style.position = "absolute";
      ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
      ripple.style.top = (e.clientY - rect.top - size / 2) + "px";
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.borderRadius = "50%";
      ripple.style.background = "rgba(255,255,255,0.35)";
      ripple.style.pointerEvents = "none";
      ripple.style.transform = "scale(0)";
      ripple.style.opacity = "1";
      ripple.style.transition = "transform .5s ease, opacity .6s ease";
      btn.style.position = btn.style.position || "relative";
      btn.style.overflow = "hidden";
      btn.appendChild(ripple);
      requestAnimationFrame(() => {
        ripple.style.transform = "scale(1)";
        ripple.style.opacity = "0";
      });
      setTimeout(() => ripple.remove(), 650);
    });
  }

  document.querySelectorAll(".glow-btn").forEach(attachRipple);
})();
