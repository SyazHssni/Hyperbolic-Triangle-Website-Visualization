import { useEffect, useRef, useState } from "react";
import { createScene } from "@/lib/scene";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  RotateCcw,
  Box,
  Square,
  Triangle,
  MousePointer2,
  Camera,
  ZoomIn,
  Info,
} from "lucide-react";

const VERTEX_META = [
  { key: "A", color: "#00F0FF" },
  { key: "B", color: "#00FF87" },
  { key: "C", color: "#FF007F" },
];

export default function HyperbolicExplorer() {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const labelRefs = useRef({});

  const [mode, setMode] = useState("2d");
  const [curvature, setCurvature] = useState(0); // slider value; a = -curvature
  const [angles, setAngles] = useState({ A: 60, B: 60, C: 60, sum: 180 });
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const api = createScene(containerRef.current, {
      onAngles: (data) => setAngles(data),
      onReset: (s) => {
        setCurvature(s.curvature);
        setMode(s.mode);
      },
    });
    apiRef.current = api;
    api.registerLabels(labelRefs.current);
    return () => api.dispose();
    // eslint-disable-next-line
  }, []);

  const handleCurvature = (val) => {
    const v = val[0];
    setCurvature(v);
    apiRef.current?.setCurvature(-v);
  };

  const handleMode = (m) => {
    if (m === mode) return;
    setMode(m);
    apiRef.current?.setMode(m);
  };

  const handleReset = () => {
    apiRef.current?.reset();
    setCurvature(0);
    toast.success("Visualization reset", {
      description: "Vertices, curvature and camera restored.",
    });
  };

  const defect = 180 - angles.sum;
  const isHyper = defect > 0.4;
  const sumColor = isHyper ? "#F59E0B" : "#10B981";

  const setLabelRef = (k) => (el) => {
    labelRefs.current[k] = el;
  };

  return (
    <div
      className="dark relative w-full h-screen overflow-hidden text-slate-100"
      style={{ background: "#070A10" }}
      data-testid="explorer-root"
    >
      {/* Header */}
      <header
        className="absolute top-0 left-0 right-0 h-16 z-40 flex items-center justify-between px-4 sm:px-6 border-b border-sky-500/20 backdrop-blur-xl"
        style={{ background: "rgba(11,15,23,0.88)" }}
      >
        <div className="flex items-center gap-3">
          <Triangle className="w-6 h-6 text-sky-400" strokeWidth={1.5} />
          <div className="leading-tight">
            <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight font-['JetBrains_Mono']">
              Hyperbolic Triangle Explorer
            </h1>
            <p className="text-[10px] sm:text-xs text-sky-400/80 font-['Fira_Code'] tracking-wide">
              Explore how negative curvature changes the angles of a triangle.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-['Fira_Code'] border"
            style={{
              borderColor: isHyper ? "rgba(245,158,11,0.4)" : "rgba(16,185,129,0.4)",
              color: isHyper ? "#F59E0B" : "#10B981",
              background: isHyper ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)",
            }}
            data-testid="mode-indicator"
          >
            {curvature > 0.001
              ? `HYPERBOLIC · K = ${(-curvature).toFixed(2)}`
              : "EUCLIDEAN · K = 0"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowInfo((s) => !s)}
            className="text-slate-300 hover:text-sky-400 hover:bg-sky-500/10"
            data-testid="info-toggle-btn"
          >
            <Info className="w-5 h-5" />
          </Button>
          <Button
            onClick={handleReset}
            variant="outline"
            className="border-sky-500/30 bg-sky-500/5 text-sky-300 hover:bg-sky-500/15 hover:text-sky-200 font-['Fira_Code'] text-xs"
            data-testid="reset-btn"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reset
          </Button>
        </div>
      </header>

      {/* Canvas + overlays */}
      <div className="absolute inset-0 top-16">
        <div
          ref={containerRef}
          className="absolute inset-0"
          data-testid="viz-canvas"
        />

        {/* label overlay (pointer-events none) */}
        <div className="absolute inset-0 pointer-events-none select-none">
          {VERTEX_META.map((v) => (
            <div
              key={"v" + v.key}
              ref={setLabelRef("v" + v.key)}
              className="absolute top-0 left-0 font-['JetBrains_Mono'] font-extrabold text-lg"
              style={{ color: v.color, textShadow: "0 0 10px rgba(0,0,0,0.9)" }}
              data-testid={`vertex-label-${v.key}`}
            >
              {v.key}
            </div>
          ))}
          {VERTEX_META.map((v) => (
            <div
              key={"d" + v.key}
              ref={setLabelRef("d" + v.key)}
              className="absolute top-0 left-0 px-2 py-0.5 rounded-md font-['Fira_Code'] text-xs font-bold border backdrop-blur-md"
              style={{
                color: "#F8FAFC",
                background: "rgba(11,15,23,0.75)",
                borderColor: "rgba(168,85,247,0.5)",
                boxShadow: "0 0 10px rgba(168,85,247,0.25)",
              }}
              data-testid={`angle-label-${v.key}`}
            >
              {angles[v.key] !== undefined ? angles[v.key].toFixed(1) : "0.0"}°
            </div>
          ))}
        </div>

        {/* Left HUD: mode + curvature */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-3 w-64 sm:w-72">
          <Card
            className="p-4 border-sky-500/20"
            style={{ background: "rgba(15,23,42,0.78)", backdropFilter: "blur(14px)" }}
          >
            <p className="text-[10px] font-['Fira_Code'] uppercase tracking-widest text-slate-400 mb-2">
              View Mode
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => handleMode("2d")}
                className={`font-['Fira_Code'] text-xs ${
                  mode === "2d"
                    ? "bg-sky-500 text-slate-900 hover:bg-sky-400"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                }`}
                data-testid="toggle-2d"
              >
                <Square className="w-4 h-4 mr-1.5" /> 2D Flat
              </Button>
              <Button
                onClick={() => handleMode("3d")}
                className={`font-['Fira_Code'] text-xs ${
                  mode === "3d"
                    ? "bg-sky-500 text-slate-900 hover:bg-sky-400"
                    : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/60"
                }`}
                data-testid="toggle-3d"
              >
                <Box className="w-4 h-4 mr-1.5" /> 3D Curved
              </Button>
            </div>
          </Card>

          <Card
            className="p-4 border-sky-500/20"
            style={{ background: "rgba(15,23,42,0.78)", backdropFilter: "blur(14px)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-['Fira_Code'] uppercase tracking-widest text-slate-400">
                Curvature K
              </p>
              <span
                className="font-['Fira_Code'] text-sm font-bold"
                style={{ color: curvature > 0.001 ? "#F59E0B" : "#10B981" }}
                data-testid="curvature-value"
              >
                {(-curvature).toFixed(2)}
              </span>
            </div>
            <Slider
              value={[curvature]}
              min={0}
              max={1.6}
              step={0.02}
              onValueChange={handleCurvature}
              data-testid="curvature-slider"
            />
            <div className="flex justify-between mt-2 text-[9px] font-['Fira_Code'] text-slate-500">
              <span>Euclidean</span>
              <span>Hyperbolic →</span>
            </div>
          </Card>
        </div>

        {/* Right HUD: angle sum + telemetry */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-3 w-60 sm:w-72">
          <Card
            className="p-4 border-sky-500/20"
            style={{ background: "rgba(15,23,42,0.78)", backdropFilter: "blur(14px)" }}
            data-testid="angle-sum-card"
          >
            <p className="text-[10px] font-['Fira_Code'] uppercase tracking-widest text-slate-400 mb-1">
              Angle Sum
            </p>
            <div className="flex items-baseline gap-2">
              <span
                className="text-4xl font-['JetBrains_Mono'] font-extrabold tracking-wider transition-colors"
                style={{ color: sumColor }}
                data-testid="angle-sum-value"
              >
                {angles.sum.toFixed(1)}°
              </span>
            </div>
            <p className="text-xs font-['Fira_Code'] text-slate-400 mt-1">
              {isHyper ? (
                <span className="text-amber-400">&lt; 180° &nbsp;·&nbsp; defect {defect.toFixed(1)}°</span>
              ) : (
                <span className="text-emerald-400">= 180° &nbsp;·&nbsp; flat / Euclidean</span>
              )}
            </p>
          </Card>

          <Card
            className="p-4 border-sky-500/20 flex flex-col gap-2"
            style={{ background: "rgba(15,23,42,0.78)", backdropFilter: "blur(14px)" }}
          >
            <p className="text-[10px] font-['Fira_Code'] uppercase tracking-widest text-slate-400 mb-1">
              Vertex Angles
            </p>
            {VERTEX_META.map((v) => (
              <div
                key={v.key}
                className="flex items-center justify-between"
                data-testid={`telemetry-${v.key}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: v.color, boxShadow: `0 0 8px ${v.color}` }}
                  />
                  <span className="font-['Fira_Code'] text-sm text-slate-300">
                    Angle {v.key}
                  </span>
                </div>
                <span className="font-['Fira_Code'] text-sm font-bold text-slate-100">
                  {angles[v.key].toFixed(1)}°
                </span>
              </div>
            ))}
          </Card>
        </div>

        {/* Bottom controls hint */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 hidden md:flex items-center gap-5 px-6 py-2.5 rounded-full border border-sky-500/25"
          style={{ background: "rgba(11,15,23,0.9)", backdropFilter: "blur(14px)" }}
          data-testid="controls-hint"
        >
          <span className="flex items-center gap-1.5 text-[11px] font-['Fira_Code'] text-slate-300">
            <MousePointer2 className="w-3.5 h-3.5 text-cyan-400" /> Left-drag vertex
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-['Fira_Code'] text-slate-300">
            <Camera className="w-3.5 h-3.5 text-sky-400" /> Right-drag orbit
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-['Fira_Code'] text-slate-300">
            <ZoomIn className="w-3.5 h-3.5 text-emerald-400" /> Scroll zoom
          </span>
        </div>

        {/* Explanation panel */}
        {showInfo && (
          <div
            className="absolute bottom-4 left-4 z-30 w-72 sm:w-80 rounded-xl border border-sky-500/25 p-5"
            style={{ background: "rgba(15,23,42,0.92)", backdropFilter: "blur(16px)" }}
            data-testid="explanation-panel"
          >
            <h3 className="font-['JetBrains_Mono'] font-bold text-emerald-400 text-sm mb-1">
              Euclidean Geometry
            </h3>
            <p className="text-xs text-slate-300 font-['Fira_Code'] leading-relaxed mb-3">
              On a flat surface, the interior angles of a triangle always add to{" "}
              <span className="text-slate-100 font-bold">180°</span>.
            </p>
            <h3 className="font-['JetBrains_Mono'] font-bold text-amber-400 text-sm mb-1">
              Hyperbolic Geometry
            </h3>
            <p className="text-xs text-slate-300 font-['Fira_Code'] leading-relaxed">
              On a negatively curved (saddle) surface, geodesic triangles have an
              angle sum{" "}
              <span className="text-slate-100 font-bold">less than 180°</span>. The
              gap is the <em>angular defect</em>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
