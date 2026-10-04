import * as THREE from "three";
import { DOMAIN, height, computeTriangle } from "@/lib/hyperbolic";

const COLORS = {
  bg: "#070A10",
  surface: "#1E293B",
  grid: 0x2d9bd6,
  geodesic: 0x38bdf8,
  arc: 0xa855f7,
  A: 0x00f0ff,
  B: 0x00ff87,
  C: 0xff007f,
};
const VERT_COLORS = [COLORS.A, COLORS.B, COLORS.C];

// Equilateral triangle, circumradius 1.3, centred at origin.
const R = 1.3;
const DEFAULT_VERTS = [
  [0, R],
  [R * Math.cos((210 * Math.PI) / 180), R * Math.sin((210 * Math.PI) / 180)],
  [R * Math.cos((330 * Math.PI) / 180), R * Math.sin((330 * Math.PI) / 180)],
];
const DEFAULT_CAM = { az: -Math.PI / 2, el: 0.62, radius: 6.2 };
const CAM_2D = { radius: 5.6 };

function v3(p) {
  return new THREE.Vector3(p[0], p[1], p[2]);
}

export function createScene(container, { onAngles, onReset }) {
  const width = container.clientWidth;
  const heightPx = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, heightPx);
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.bg);

  const camera = new THREE.PerspectiveCamera(50, width / heightPx, 0.1, 200);
  camera.up.set(0, 0, 1);

  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(4, 4, 8);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
  dir2.position.set(-6, -4, 3);
  scene.add(dir2);

  // ---- shared math state ----
  let verts = DEFAULT_VERTS.map((p) => [...p]);
  let aRef = 0; // actual curvature a (<=0). slider sends negative value.
  let mode = "2d";
  let morph = 0; // 0 = flat drawing, 1 = full 3D curved drawing
  let morphTarget = 0;
  let morphing = false;
  const cam = { ...DEFAULT_CAM };

  // drawing-space z (gated by morph; math always uses full aRef)
  const zAt = (u, v) => height(u, v, aRef) * morph;
  const dp = (u, v) => new THREE.Vector3(u, v, zAt(u, v));

  // ---- surface + grid ----
  const SEG = 48;
  let surfaceMesh;
  let gridLines;
  function buildSurface() {
    if (surfaceMesh) {
      scene.remove(surfaceMesh);
      surfaceMesh.geometry.dispose();
    }
    const geo = new THREE.PlaneGeometry(DOMAIN * 2, DOMAIN * 2, SEG, SEG);
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      posAttr.setZ(i, zAt(x, y));
    }
    geo.computeVertexNormals();
    surfaceMesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: COLORS.surface,
        transparent: true,
        opacity: 0.82,
        roughness: 0.85,
        metalness: 0.1,
        side: THREE.DoubleSide,
      })
    );
    scene.add(surfaceMesh);

    if (gridLines) {
      scene.remove(gridLines);
      gridLines.geometry.dispose();
    }
    const G = 24;
    const steps = 60;
    const pts = [];
    for (let gi = 0; gi <= G; gi++) {
      const u = -DOMAIN + (2 * DOMAIN * gi) / G;
      for (let s = 0; s < steps; s++) {
        const v0 = -DOMAIN + (2 * DOMAIN * s) / steps;
        const v1 = -DOMAIN + (2 * DOMAIN * (s + 1)) / steps;
        pts.push(u, v0, zAt(u, v0) - 0.004, u, v1, zAt(u, v1) - 0.004);
      }
    }
    for (let gi = 0; gi <= G; gi++) {
      const v = -DOMAIN + (2 * DOMAIN * gi) / G;
      for (let s = 0; s < steps; s++) {
        const u0 = -DOMAIN + (2 * DOMAIN * s) / steps;
        const u1 = -DOMAIN + (2 * DOMAIN * (s + 1)) / steps;
        pts.push(u0, v, zAt(u0, v) - 0.004, u1, v, zAt(u1, v) - 0.004);
      }
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    gridLines = new THREE.LineSegments(
      gGeo,
      new THREE.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.28 })
    );
    gridLines.raycast = () => {};
    scene.add(gridLines);
  }

  // ---- tubes for edges + arcs ----
  function makeTube(color) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color }));
    m.raycast = () => {};
    scene.add(m);
    return m;
  }
  function updateTube(mesh, vecs, radius) {
    const curve = new THREE.CatmullRomCurve3(vecs);
    const geo = new THREE.TubeGeometry(curve, Math.max(24, vecs.length), radius, 8, false);
    mesh.geometry.dispose();
    mesh.geometry = geo;
  }
  const edges = { AB: makeTube(COLORS.geodesic), BC: makeTube(COLORS.geodesic), CA: makeTube(COLORS.geodesic) };
  const arcs = [makeTube(COLORS.arc), makeTube(COLORS.arc), makeTube(COLORS.arc)];

  // ---- vertices ----
  const vertexGroups = VERT_COLORS.map((c) => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 24), new THREE.MeshBasicMaterial({ color: c }));
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 20, 20),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.25 })
    );
    halo.raycast = () => {};
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    g.add(core, halo, hit);
    g.userData.hit = hit;
    scene.add(g);
    return g;
  });

  // ---- label anchors ----
  const anchors = {
    vA: new THREE.Vector3(), vB: new THREE.Vector3(), vC: new THREE.Vector3(),
    dA: new THREE.Vector3(), dB: new THREE.Vector3(), dC: new THREE.Vector3(),
  };
  let labelEls = null;
  const registerLabels = (els) => { labelEls = els; };

  function slerp(t1, t2, s) {
    const a1 = t1.clone(), a2 = t2.clone();
    let dot = Math.max(-1, Math.min(1, a1.dot(a2)));
    const theta = Math.acos(dot) * s;
    const rel = a2.clone().sub(a1.clone().multiplyScalar(dot));
    if (rel.length() < 1e-6) return a1;
    rel.normalize();
    return a1.multiplyScalar(Math.cos(theta)).add(rel.multiplyScalar(Math.sin(theta)));
  }

  // drawing-space unit tangent of a param-path leaving vertex (fromStart) or arriving (end)
  function drawTangent(path, fromStart) {
    const p0 = fromStart ? path[0] : path[path.length - 1];
    const p1 = fromStart ? path[1] : path[path.length - 2];
    return dp(p1[0], p1[1]).sub(dp(p0[0], p0[1])).normalize();
  }

  function recompute() {
    const tri = computeTriangle(verts, aRef); // true hyperbolic math
    const liftPath = (arr) =>
      arr.map((p) => new THREE.Vector3(p[0], p[1], zAt(p[0], p[1]) + 0.03));
    updateTube(edges.AB, liftPath(tri.edges.AB), 0.035);
    updateTube(edges.BC, liftPath(tri.edges.BC), 0.035);
    updateTube(edges.CA, liftPath(tri.edges.CA), 0.035);

    const world = verts.map((p) => dp(p[0], p[1]));
    vertexGroups.forEach((g, i) => g.position.copy(world[i]));
    const centroid = world[0].clone().add(world[1]).add(world[2]).multiplyScalar(1 / 3);

    // drawing-space tangents per vertex (from the drawn geodesics)
    const dirs = {
      A: [drawTangent(tri.edges.AB, true), drawTangent(tri.edges.CA, false)],
      B: [drawTangent(tri.edges.AB, false), drawTangent(tri.edges.BC, true)],
      C: [drawTangent(tri.edges.BC, false), drawTangent(tri.edges.CA, true)],
    };

    ["A", "B", "C"].forEach((k, i) => {
      const [t1, t2] = dirs[k];
      const V = verts[i];
      const r = 0.42;
      const pts = [];
      const nArc = 20;
      for (let j = 0; j <= nArc; j++) {
        const d = slerp(t1, t2, j / nArc);
        const u = V[0] + d.x * r;
        const vv = V[1] + d.y * r;
        pts.push(new THREE.Vector3(u, vv, zAt(u, vv) + 0.04));
      }
      updateTube(arcs[i], pts, 0.022);

      const bis = slerp(t1, t2, 0.5);
      const du = V[0] + bis.x * r * 1.35;
      const dv = V[1] + bis.y * r * 1.35;
      anchors["d" + k].set(du, dv, zAt(du, dv) + 0.06);

      const out = world[i].clone().sub(centroid);
      out.z = 0;
      if (out.length() < 1e-4) out.set(0, 1, 0);
      out.normalize().multiplyScalar(0.52);
      anchors["v" + k].copy(world[i]).add(out);
      anchors["v" + k].z += 0.12;
    });

    if (onAngles) onAngles({ ...tri.angles, sum: tri.sum, curvature: aRef, mode });
  }

  function updateCamera() {
    if (mode === "2d") {
      camera.up.set(0, 1, 0);
      camera.position.set(0, 0, cam.radius);
      camera.lookAt(0, 0, 0);
    } else {
      camera.up.set(0, 0, 1);
      const ce = Math.cos(cam.el);
      camera.position.set(
        cam.radius * ce * Math.cos(cam.az),
        cam.radius * ce * Math.sin(cam.az),
        cam.radius * Math.sin(cam.el)
      );
      camera.lookAt(0, 0, 0);
    }
  }

  // ---- interaction ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let orbiting = false;
  let draggingIdx = -1;
  let dragOffset = [0, 0];
  let lastX = 0, lastY = 0;

  function setNdc(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  function raycastVertex() {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(vertexGroups.map((g) => g.userData.hit), false);
    if (hits.length) {
      const obj = hits[0].object;
      return vertexGroups.findIndex((g) => g.userData.hit === obj);
    }
    return -1;
  }
  function raycastSurfaceParam() {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(surfaceMesh, false);
    if (hits.length) return [hits[0].point.x, hits[0].point.y];
    return null;
  }

  function onPointerDown(e) {
    setNdc(e);
    lastX = e.clientX; lastY = e.clientY;
    if (e.button === 2) {
      if (mode === "3d") orbiting = true; // right = camera only, 3D only
      renderer.domElement.setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button === 0) {
      const idx = raycastVertex();
      if (idx >= 0) {
        const hp = raycastSurfaceParam();
        draggingIdx = idx;
        dragOffset = hp ? [verts[idx][0] - hp[0], verts[idx][1] - hp[1]] : [0, 0];
        renderer.domElement.setPointerCapture?.(e.pointerId);
      }
    }
  }
  function onPointerMove(e) {
    if (orbiting) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      cam.az -= dx * 0.006;
      cam.el += dy * 0.006; // drag down -> camera up -> reveal upper surface
      cam.el = Math.max(-1.45, Math.min(1.45, cam.el));
      updateCamera();
      return;
    }
    if (draggingIdx >= 0) {
      setNdc(e);
      const hp = raycastSurfaceParam();
      if (hp) {
        let nu = Math.max(-DOMAIN + 0.1, Math.min(DOMAIN - 0.1, hp[0] + dragOffset[0]));
        let nv = Math.max(-DOMAIN + 0.1, Math.min(DOMAIN - 0.1, hp[1] + dragOffset[1]));
        verts[draggingIdx] = [nu, nv];
        recompute();
      }
    }
  }
  function onPointerUp(e) {
    orbiting = false;
    draggingIdx = -1;
    renderer.domElement.releasePointerCapture?.(e.pointerId);
  }
  function onWheel(e) {
    e.preventDefault();
    cam.radius *= 1 + e.deltaY * 0.001;
    cam.radius = Math.max(2.8, Math.min(18, cam.radius));
    updateCamera();
  }
  function onContext(e) { e.preventDefault(); }

  const el = renderer.domElement;
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointerleave", onPointerUp);
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("contextmenu", onContext);

  const tmp = new THREE.Vector3();
  function projectLabels() {
    if (!labelEls) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    Object.keys(anchors).forEach((k) => {
      const elRef = labelEls[k];
      if (!elRef) return;
      tmp.copy(anchors[k]).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      elRef.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
      elRef.style.opacity = tmp.z > 1 ? "0" : "1";
    });
  }

  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);
    if (morphing) {
      const d = morphTarget - morph;
      if (Math.abs(d) < 0.02) {
        morph = morphTarget;
        morphing = false;
      } else {
        morph += d * 0.18;
      }
      buildSurface();
      recompute();
    }
    projectLabels();
    renderer.render(scene, camera);
  }

  function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);

  buildSurface();
  updateCamera();
  recompute();
  animate();

  return {
    registerLabels,
    setCurvature(val) {
      aRef = val;
      buildSurface();
      recompute();
    },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      if (m === "3d") {
        cam.az = DEFAULT_CAM.az; cam.el = DEFAULT_CAM.el; cam.radius = DEFAULT_CAM.radius;
        morphTarget = 1; morphing = true;
      } else {
        cam.radius = CAM_2D.radius;
        morphTarget = 0; morphing = true;
      }
      updateCamera();
      recompute();
    },
    reset() {
      verts = DEFAULT_VERTS.map((p) => [...p]);
      aRef = 0;
      mode = "2d";
      morph = 0; morphTarget = 0; morphing = false;
      cam.radius = CAM_2D.radius;
      buildSurface();
      updateCamera();
      recompute();
      if (onReset) onReset({ curvature: 0, mode: "2d" });
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("contextmenu", onContext);
      renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el);
    },
  };
}
