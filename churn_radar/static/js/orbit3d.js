/**
 * "Customer Orbit" — a lightweight, dependency-free (besides three.js core)
 * 3D point cloud. Each point is a real sampled customer, positioned by
 * tenure / monthly charges / total charges, coloured by churn outcome.
 * Fully interactive: drag to rotate, scroll/pinch to zoom, right-drag to pan.
 * Implemented with a hand-rolled orbit control (no OrbitControls.js addon
 * available offline) so it's self-contained.
 */
(function () {
  const wrap = document.getElementById("orbit-canvas-wrap");
  if (!wrap || typeof THREE === "undefined") return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 100);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(wrap.clientWidth, wrap.clientHeight);
  wrap.appendChild(renderer.domElement);

  // ---- simple orbit rig ----
  const rig = { radius: 4.4, theta: Math.PI / 3.2, phi: Math.PI / 2.4, target: new THREE.Vector3(0, 0, 0) };
  function updateCamera() {
    const { radius, theta, phi, target } = rig;
    camera.position.set(
      target.x + radius * Math.sin(phi) * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(target);
  }
  updateCamera();

  // wireframe bounding cube for spatial reference
  const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
  const cubeEdges = new THREE.EdgesGeometry(cubeGeo);
  const cube = new THREE.LineSegments(cubeEdges, new THREE.LineBasicMaterial({ color: 0x223049, transparent: true, opacity: 0.6 }));
  scene.add(cube);

  // axis ticks (tiny, decorative but grounded — tenure/charges/total)
  const axisMat = new THREE.LineBasicMaterial({ color: 0x33e6c9, transparent: true, opacity: 0.35 });
  [
    [[-1, -1, -1], [1, -1, -1]],
    [[-1, -1, -1], [-1, 1, -1]],
    [[-1, -1, -1], [-1, -1, 1]],
  ].forEach(([a, b]) => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    scene.add(new THREE.Line(geo, axisMat));
  });

  let pointsMesh = null;

  function buildPoints(data) {
    const n = data.points.length;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const riskColor = new THREE.Color(0xff8a3d);
    const safeColor = new THREE.Color(0x33e6c9);

    data.points.forEach((p, i) => {
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const c = p.churn ? riskColor : safeColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
    });

    pointsMesh = new THREE.Points(geometry, material);
    scene.add(pointsMesh);
  }

  fetch("/api/customer-cloud")
    .then((r) => r.json())
    .then(buildPoints)
    .catch(() => {});

  // ---- pointer interaction ----
  let dragging = false;
  let panning = false;
  let lastX = 0, lastY = 0;

  function onDown(e) {
    dragging = true;
    panning = e.button === 2;
    lastX = e.clientX; lastY = e.clientY;
  }
  function onMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    if (panning) {
      const panSpeed = 0.0025 * rig.radius;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      rig.target.addScaledVector(right, -dx * panSpeed);
      rig.target.addScaledVector(up, dy * panSpeed);
    } else {
      rig.theta -= dx * 0.006;
      rig.phi = Math.min(Math.max(rig.phi - dy * 0.006, 0.15), Math.PI - 0.15);
    }
    updateCamera();
  }
  function onUp() { dragging = false; }
  function onWheel(e) {
    e.preventDefault();
    rig.radius = Math.min(Math.max(rig.radius + e.deltaY * 0.0032, 1.8), 12);
    updateCamera();
  }

  renderer.domElement.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  // touch support: one-finger rotate, two-finger pinch zoom
  let lastTouchDist = null;
  renderer.domElement.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      dragging = true; panning = false;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  renderer.domElement.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && dragging) {
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      rig.theta -= dx * 0.006;
      rig.phi = Math.min(Math.max(rig.phi - dy * 0.006, 0.15), Math.PI - 0.15);
      updateCamera();
    } else if (e.touches.length === 2 && lastTouchDist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      rig.radius = Math.min(Math.max(rig.radius - (dist - lastTouchDist) * 0.01, 1.8), 12);
      lastTouchDist = dist;
      updateCamera();
    }
  }, { passive: true });
  renderer.domElement.addEventListener("touchend", () => { dragging = false; lastTouchDist = null; });

  function onResize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  function animate() {
    requestAnimationFrame(animate);
    if (!dragging) {
      rig.theta += 0.0009; // slow idle drift so it always reads as "alive"
      updateCamera();
    }
    if (pointsMesh) pointsMesh.rotation.y += 0; // reserved (kept static; camera orbits instead)
    renderer.render(scene, camera);
  }
  animate();
})();
