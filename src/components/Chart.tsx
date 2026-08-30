import { lazy, Suspense, useEffect, useState, memo } from "react";
import type { PlotParams } from "react-plotly.js";

const Plot = lazy(() => import("./PlotlyChart"));

export const PLOT_FONT = {
  family: '"IBM Plex Mono", monospace',
  size: 11,
  color: "#7a7065",
};

export const PLOT_CONFIG = {
  displayModeBar: false,
  responsive: true,
  scrollZoom: true,
};

type Props = Omit<PlotParams, "config"> & {
  height: number;
  config?: PlotParams["config"];
};

function ChartInner({ height, ...rest }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="w-full rounded-[10px] bg-surface" style={{ height }} />;
  }

  return (
    <Suspense fallback={<div className="w-full rounded-[10px] bg-surface" style={{ height }} />}>
      <Plot
        {...rest}
        config={{ ...PLOT_CONFIG, ...(rest.config ?? {}) }}
        style={{ width: "100%", height }}
        useResizeHandler
      />
    </Suspense>
  );
}

export const Chart = memo(ChartInner);
