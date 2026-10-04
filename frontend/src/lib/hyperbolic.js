// Hyperbolic triangle math on a saddle surface z = a*(u^2 - v^2).
// Curvature param `a`: 0 => flat Euclidean plane, more negative => stronger negative curvature.
// Edges are TRUE (discrete) geodesics found by energy minimization; angles are measured
// between geodesic tangent directions in the local tangent plane (induced metric).

export const DOMAIN = 2.3;

export function height(u, v, a) {
  return a * (u * u - v * v);
}

export function pos(u, v, a) {
  return [u, v, height(u, v, a)];
}

function sub(p, q) {
  return [p[0] - q[0], p[1] - q[1], p[2] - q[2]];
}
function norm(p) {
  return Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
}

// Discrete geodesic between param points A=[u,v] and B=[u,v] on the saddle.
// Jacobi-preconditioned Gauss-Seidel minimization of path energy sum|P_{i+1}-P_i|^2.
export function solveGeodesic(A, B, a, N = 24, iters = 220) {
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
  }
  if (a === 0) return pts; // straight line is the Euclidean geodesic

  const P3 = pts.map((p) => pos(p[0], p[1], a));
  for (let it = 0; it < iters; it++) {
    for (let i = 1; i < N - 1; i++) {
      const u = pts[i][0];
      const v = pts[i][1];
      const fu = 2 * a * u;
      const fv = -2 * a * v;
      const d1 = sub(P3[i], P3[i - 1]);
      const d2 = sub(P3[i + 1], P3[i]);
      // grad of energy wrt (u,v) = 2*(d1 - d2) . dP/d(u,v), J = [[1,0],[0,1],[fu,fv]]
      const dx = d1[0] - d2[0];
      const dy = d1[1] - d2[1];
      const dz = d1[2] - d2[2];
      const gu = 2 * (dx + dz * fu);
      const gv = 2 * (dy + dz * fv);
      const H = 2 * (2 + fu * fu + fv * fv); // approx hessian diagonal
      let nu = u - gu / H;
      let nv = v - gv / H;
      nu = Math.max(-DOMAIN, Math.min(DOMAIN, nu));
      nv = Math.max(-DOMAIN, Math.min(DOMAIN, nv));
      pts[i][0] = nu;
      pts[i][1] = nv;
      P3[i] = pos(nu, nv, a);
    }
  }
  return pts;
}

// 3D unit tangent of a geodesic path. fromStart => direction leaving pts[0].
export function tangent3(path, a, fromStart = true) {
  let p0, p1;
  if (fromStart) {
    p0 = path[0];
    p1 = path[1];
  } else {
    p0 = path[path.length - 1];
    p1 = path[path.length - 2];
  }
  const d = sub(pos(p1[0], p1[1], a), pos(p0[0], p0[1], a));
  const n = norm(d) || 1;
  return [d[0] / n, d[1] / n, d[2] / n];
}

export function angleBetween(t1, t2) {
  let c = t1[0] * t2[0] + t1[1] * t2[1] + t1[2] * t2[2];
  c = Math.max(-1, Math.min(1, c));
  return (Math.acos(c) * 180) / Math.PI;
}

// Full triangle solve. verts = [A,B,C] each [u,v]. Returns geodesics, angles, sum.
export function computeTriangle(verts, a) {
  const [A, B, C] = verts;
  const AB = solveGeodesic(A, B, a);
  const BC = solveGeodesic(B, C, a);
  const CA = solveGeodesic(C, A, a);

  const tAB = tangent3(AB, a, true); // leaving A toward B
  const tAC = tangent3(CA, a, false); // leaving A toward C (CA reversed)
  const tBA = tangent3(AB, a, false); // leaving B toward A
  const tBC = tangent3(BC, a, true); // leaving B toward C
  const tCB = tangent3(BC, a, false); // leaving C toward B
  const tCA = tangent3(CA, a, true); // leaving C toward A

  const angA = angleBetween(tAB, tAC);
  const angB = angleBetween(tBA, tBC);
  const angC = angleBetween(tCB, tCA);

  return {
    edges: { AB, BC, CA },
    tangents: {
      A: [tAB, tAC],
      B: [tBA, tBC],
      C: [tCB, tCA],
    },
    angles: { A: angA, B: angB, C: angC },
    sum: angA + angB + angC,
  };
}
