import * as THREE from "three";
import {
  DOMAIN,
  height,
  pos,
  computeTriangle,
} from "@/lib/hyperbolic";

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

const DEFAULT_VERTS = [
  [0.0, 1.35],
  [-1.35, -0.95],
  [1.35, -0.95],
];
const DEFAULT_CAM = { az: -Math.PI / 2, el: 0.62, radius: 6.2 };

function v3(p) {
  return new THREE.Vector3(p[0], p[1], p[2]);
}

export function createScene(container, { onAngles, onCurvatureReset }) {
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

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(4, 4, 8);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0x38bdf8, 0.4);
  dir2.position.set(-6, -4, 3);
  scene.add(dir2);

  // ---- state ----
  let verts = DEFAULT_VERTS.map((p) => [...p]);
  let aRef = 0; // slider curvature (actual a is negative value)
  let mode = "3d";
  const cam = { ...DEFAULT_CAM };
  const effA = () => (mode === "2d" ? 0 : aRef);

  // ---- surface mesh ----
  const SEG = 48;
  let surfaceMesh;
  let gridLines;
  function buildSurface() {
    const a = effA();
    if (surfaceMesh) {
      scene.remove(surfaceMesh);
      surfaceMesh.geometry.dispose();
    }
    const geo = new THREE.PlaneGeometry(DOMAIN * 2, DOMAIN * 2, SEG, SEG);
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      posAttr.setZ(i, height(x, y, a));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.surface,
      transparent: true,
      opacity: 0.82,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    surfaceMesh = new THREE.Mesh(geo, mat);
    surfaceMesh.renderOrder = 0;
    scene.add(surfaceMesh);

    // grid lines on the surface
    if (gridLines) {
      scene.remove(gridLines);
      gridLines.geometry.dispose();
    }
    const G = 24;
    const pts = [];
    const steps = 60;
    for (let gi = 0; gi <= G; gi++) {
      const u = -DOMAIN + (2 * DOMAIN * gi) / G;
      for (let s = 0; s < steps; s++) {
        const v0 = -DOMAIN + (2 * DOMAIN * s) / steps;
        const v1 = -DOMAIN + (2 * DOMAIN * (s + 1)) / steps;
        pts.push(u, v0, height(u, v0, a) - 0.003, u, v1, height(u, v1, a) - 0.003);
      }
    }
    for (let gi = 0; gi <= G; gi++) {
      const v = -DOMAIN + (2 * DOMAIN * gi) / G;
      for (let s = 0; s < steps; s++) {
        const u0 = -DOMAIN + (2 * DOMAIN * s) / steps;
        const u1 = -DOMAIN + (2 * DOMAIN * (s + 1)) / steps;
        pts.push(u0, v, height(u0, v, a) - 0.003, u1, v, height(u1, v, a) - 0.003);
      }
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const gMat = new THREE.LineBasicMaterial({
      color: COLORS.grid,
      transparent: true,
      opacity: 0.28,
    });
    gridLines = new THREE.LineSegments(gGeo, gMat);
    gridLines.raycast = () => {}; // never intercept pointer
    scene.add(gridLines);
  }

  // ---- triangle objects (tubes so they are clearly visible) ----
  function makeTube(color) {
    const m = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color })
    );
    m.raycast = () => {};
    scene.add(m);
    return m;
  }
  function updateTube(mesh, points3, radius) {
    const vecs = points3.map((p) => v3(p));
    const curve = new THREE.CatmullRomCurve3(vecs);
    const geo = new THREE.TubeGeometry(curve, Math.max(24, points3.length), radius, 8, false);
    mesh.geometry.dispose();
    mesh.geometry = geo;
  }
  const edges = {
    AB: makeTube(COLORS.geodesic),
    BC: makeTube(COLORS.geodesic),
    CA: makeTube(COLORS.geodesic),
  };
  const arcs = [makeTube(COLORS.arc), makeTube(COLORS.arc), makeTube(COLORS.arc)];

  // vertices: visible small sphere + invisible larger hit sphere
  const vertexGroups = VERT_COLORS.map((c) => {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 24, 24),
      new THREE.MeshBasicMaterial({ color: c })
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 20, 20),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.25 })
    );
    halo.raycast = () => {};
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.userData.isHit = true;
    g.add(core, halo, hit);
    g.userData.hit = hit;
    scene.add(g);
    return g;
  });

  // ---- anchors for HTML labels ----
  const anchors = {
    vA: new THREE.Vector3(),
    vB: new THREE.Vector3(),
    vC: new THREE.Vector3(),
    dA: new THREE.Vector3(),
    dB: new THREE.Vector3(),
    dC: new THREE.Vector3(),
  };
  let labelEls = null;
  function registerLabels(els) {
    labelEls = els;
  }

  function slerp(t1, t2, s) {
    const a1 = new THREE.Vector3(t1[0], t1[1], t1[2]);
    const a2 = new THREE.Vector3(t2[0], t2[1], t2[2]);
    let dot = Math.max(-1, Math.min(1, a1.dot(a2)));
    const theta = Math.acos(dot) * s;
    const rel = a2.clone().sub(a1.clone().multiplyScalar(dot));
    if (rel.length() < 1e-6) return a1;
    rel.normalize();
    return a1.multiplyScalar(Math.cos(theta)).add(rel.multiplyScalar(Math.sin(theta)));
  }

  function setLine(line, points3) {
    line.geometry.setFromPoints(points3.map((p) => v3(p)));
  }

  // ---- recompute geometry (on vertex/curvature/mode change) ----
  function recompute() {
    const a = effA();
    const tri = computeTriangle(verts, a);

    // edges (geodesic tubes)
    const lift = (arr) =>
      arr.map((p) => [p[0], p[1], height(p[0], p[1], a) + 0.03]);
    updateTube(edges.AB, lift(tri.edges.AB), 0.035);
    updateTube(edges.BC, lift(tri.edges.BC), 0.035);
    updateTube(edges.CA, lift(tri.edges.CA), 0.035);

    // vertex positions
    const world = verts.map((p) => v3(pos(p[0], p[1], a)));
    vertexGroups.forEach((g, i) => g.position.copy(world[i]));
    const centroid = world[0]
      .clone()
      .add(world[1])
      .add(world[2])
      .multiplyScalar(1 / 3);

    // arcs + anchors per vertex
    const keys = ["A", "B", "C"];
    keys.forEach((k, i) => {
      const [t1, t2] = tri.tangents[k];
      const V = verts[i];
      const r = 0.42;
      const pts = [];
      const nArc = 20;
      for (let j = 0; j <= nArc; j++) {
        const d = slerp(t1, t2, j / nArc);
        const u = V[0] + d.x * r;
        const vv = V[1] + d.y * r;
        pts.push([u, vv, height(u, vv, a) + 0.04]);
      }
      updateTube(arcs[i], pts, 0.022);

      // degree anchor: along inward bisector
      const bis = slerp(t1, t2, 0.5);
      const du = V[0] + bis.x * r * 1.35;
      const dv = V[1] + bis.y * r * 1.35;
      anchors["d" + k].set(du, dv, height(du, dv, a) + 0.05);

      // vertex label anchor: outside, away from centroid
      const wv = world[i];
      const out = wv.clone().sub(centroid);
      out.z = 0;
      if (out.length() < 1e-4) out.set(0, 1, 0);
      out.normalize().multiplyScalar(0.5);
      anchors["v" + k].copy(wv).add(out);
      anchors["v" + k].z += 0.12;
    });

    if (onAngles) onAngles({ ...tri.angles, sum: tri.sum, curvature: aRef, mode });
  }

  // ---- camera ----
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
  let lastX = 0;
  let lastY = 0;

  function setNdc(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function raycastVertex() {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      vertexGroups.map((g) => g.userData.hit),
      false
    );
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
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.button === 2) {
      // right = camera only (even over a vertex)
      orbiting = true;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.button === 0) {
      const idx = raycastVertex();
      if (idx >= 0) {
        const hp = raycastSurfaceParam();
        draggingIdx = idx;
        if (hp) {
          dragOffset = [verts[idx][0] - hp[0], verts[idx][1] - hp[1]];
        } else {
          dragOffset = [0, 0];
        }
        renderer.domElement.setPointerCapture?.(e.pointerId);
      }
      // left on empty space => nothing
    }
  }

  function onPointerMove(e) {
    if (orbiting) {
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (mode === "3d") {
        cam.az -= dx * 0.006; // drag right -> view rotates right
        cam.el += dy * 0.006; // drag down -> camera up -> reveal upper surface
        cam.el = Math.max(-1.45, Math.min(1.45, cam.el));
        updateCamera();
      }
      return;
    }
    if (draggingIdx >= 0) {
      setNdc(e);
      const hp = raycastSurfaceParam();
      if (hp) {
        let nu = hp[0] + dragOffset[0];
        let nv = hp[1] + dragOffset[1];
        nu = Math.max(-DOMAIN + 0.1, Math.min(DOMAIN - 0.1, nu));
        nv = Math.max(-DOMAIN + 0.1, Math.min(DOMAIN - 0.1, nv));
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

  function onContext(e) {
    e.preventDefault();
  }

  const el = renderer.domElement;
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointerleave", onPointerUp);
  el.addEventListener("wheel", onWheel, { passive: false });
  el.addEventListener("contextmenu", onContext);

  // ---- label projection each frame ----
  const tmp = new THREE.Vector3();
  function projectLabels() {
    if (!labelEls) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    Object.keys(anchors).forEach((k) => {
      const elRef = labelEls[k];
      if (!elRef) return;
      tmp.copy(anchors[k]).project(camera);
      const behind = tmp.z > 1;
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      elRef.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
      elRef.style.opacity = behind ? "0" : "1";
    });
  }

  // ---- render loop ----
  let raf;
  function animate() {
    raf = requestAnimationFrame(animate);
    projectLabels();
    renderer.render(scene, camera);
  }

  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);

  // init
  buildSurface();
  updateCamera();
  recompute();
  animate();

  // ---- public api ----
  return {
    registerLabels,
    setCurvature(val) {
      aRef = val;
      if (mode === "3d") {
        buildSurface();
        recompute();
      }
    },
    setMode(m) {
      mode = m;
      buildSurface();
      updateCamera();
      recompute();
    },
    reset() {
      verts = DEFAULT_VERTS.map((p) => [...p]);
      aRef = 0;
      Object.assign(cam, DEFAULT_CAM);
      if (mode === "2d") {
        cam.radius = DEFAULT_CAM.radius;
      }
      buildSurface();
      updateCamera();
      recompute();
      if (onCurvatureReset) onCurvatureReset(0);
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
