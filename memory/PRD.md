# Hyperbolic Triangle Explorer — PRD

## Original Problem Statement
A focused interactive math visualization for understanding hyperbolic geometry. Pedagogical flow:
start in 2D with a flat equilateral triangle (sum 180°); student drags vertices (sum stays 180° at K=0);
student increases negative curvature in 2D and watches the angle sum drop below 180° with sides curving
concave; student toggles to 3D to see the SAME configuration on a negatively curved saddle surface.
2D and 3D share one math state (no reset on toggle). Full 3D orbit camera, surface-constrained vertex
dragging, geodesic edges, angle arcs + degree labels + vertex labels attached to geometry. No login,
games, quizzes, chatbots, calculators, or spherical geometry.

## Architecture
- Frontend-only: React 19 + Vite + Tailwind v4 + shadcn/ui + Three.js (vanilla). No backend/DB/auth.
- `src/lib/hyperbolic.js`: saddle model z = a(u²−v²); true discrete geodesics via energy minimization
  (Jacobi-preconditioned Gauss-Seidel); angles measured between geodesic tangents (induced metric).
  Verified: K=0 → sum 180°, more negative K → monotonically smaller sum.
- `src/lib/scene.js`: Three.js engine. Shared math state (verts param, curvature a, mode, morph).
  Surface mesh + deforming grid, geodesic tubes, angle-arc tubes, vertex spheres (+invisible hit spheres),
  HTML label projection, custom orbit camera, raycast drag, morph animation for 2D↔3D.
- `src/components/HyperbolicExplorer.jsx`: HUD (2D/3D toggle, curvature slider, angle-sum card, vertex
  telemetry, reset, info panel) + projected overlay labels (A/B/C + degrees).

## User Persona
Students / educators exploring non-Euclidean geometry.

## Core Requirements (static)
- Start: 2D, flat, equilateral, 60/60/60, sum 180°.
- Curvature works in both 2D and 3D; shared state preserved across toggles.
- True geodesics + consistent angle sum; sum < 180° under negative curvature.
- 3D: right-drag orbit (down→reveal upper surface), left-drag vertex (surface-constrained, no teleport),
  right-drag over vertex = camera, scroll zoom, no context menu.
- Labels attached to geometry (reproject on camera move). Reset restores initial 2D state.

## Implemented (2026-06)
- Full pedagogical 2D→3D flow with morph transition. [done]
- Verified via testing agent: 10/10 scenarios PASS (initial state, 2D drag, 2D curvature, 2D↔3D state
  preservation, 3D orbit, context-menu suppression, reset). Frontend 100%.

## Backlog / Future (P2)
- Optional preset triangles; optional softer curvature range; touch-gesture camera on mobile.
