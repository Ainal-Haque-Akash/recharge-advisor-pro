import { memo, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Chart, PLOT_FONT } from "@/components/Chart";
import type { MeterCase } from "@/data/cases";
import { bdt } from "@/lib/meter";

const RANGES = [30, 60, 90, 180];

type Props = {
  meterCase: MeterCase;
  rangeDays: number;
  onRangeChange: (d: number) => void;
  onHoverRecharge: (date: string | null) => void;
  selected: { date: string; amount: number } | null;
  onSelectRecharge: (r: { date: string; amount: number } | null) => void;
};

function BalanceChartInner({
  meterCase,
  rangeDays,
  onRangeChange,
  onHoverRecharge,
  selected,
  onSelectRecharge,
}: Props) {
  const slice = useMemo(
    () => meterCase.history.slice(-rangeDays),
    [meterCase, rangeDays],
  );

  const traces = useMemo(() => {
    const first = slice[0]?.date ?? "";
    const marks = meterCase.recharges.filter((r) => r.date >= first);
    const byDate = new Map(slice.map((d) => [d.date, d.balance]));
    return [
      {
        type: "scatter" as const,
        mode: "lines" as const,
        name: "Balance",
        x: slice.map((d) => d.date),
        y: slice.map((d) => d.balance),
        line: { color: "#c2772a", width: 2, shape: "spline" as const },
        fill: "tozeroy" as const,
        fillcolor: "rgba(194,119,42,0.12)",
        hovertemplate: "%{x|%d %b}<br>৳ %{y:,.0f}<extra></extra>",
      },
      {
        type: "scatter" as const,
        mode: "markers" as const,
        name: "Recharge",
        x: marks.map((r) => r.date),
        y: marks.map((r) => byDate.get(r.date) ?? 0),
        customdata: marks.map((r) => r.amount),
        marker: {
          symbol: "triangle-up" as const,
          size: 12,
          color: "#a8442a",
          line: { color: "#fffdf9", width: 1 },
        },
        hovertemplate: "Recharge ৳ %{customdata:,.0f}<br>%{x|%d %b}<extra></extra>",
      },
    ];
  }, [slice, meterCase]);

  const layout = useMemo(
    () => ({
      margin: { l: 52, r: 16, t: 10, b: 32 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "#f8f4ec",
      font: PLOT_FONT,
      showlegend: false,
      dragmode: "pan" as const,
      hovermode: "closest" as const,
      hoverlabel: {
        bgcolor: "#2a241d",
        bordercolor: "#2a241d",
        font: { color: "#fffdf9", family: '"IBM Plex Mono", monospace', size: 11 },
      },
      xaxis: {
        gridcolor: "#e6ddd0",
        linecolor: "#e6ddd0",
        tickformat: "%d %b",
        zeroline: false,
      },
      yaxis: {
        gridcolor: "#e6ddd0",
        linecolor: "#e6ddd0",
        tickprefix: "৳ ",
        zeroline: false,
        rangemode: "tozero" as const,
      },
    }),
    [],
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-balance font-display text-xl font-semibold leading-tight">
            Balance over time
          </h2>
          <p className="text-sm text-muted">
            Daily balance · red markers are recharge events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-[11px] uppercase tracking-[0.14em] text-muted">Range</span>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={
                r === rangeDays
                  ? "rounded-[8px] bg-amber px-2.5 py-1 text-xs font-medium text-panel"
                  : "rounded-[8px] border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-amber hover:text-ink"
              }
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="relative rounded-[10px] bg-surface p-2 ring-1 ring-black/5">
          <Chart
            height={268}
            data={traces}
            layout={layout}
            onHover={(e) => {
              const p = e.points?.[0];
              onHoverRecharge(p && p.curveNumber === 1 ? String(p.x) : null);
            }}
            onUnhover={() => onHoverRecharge(null)}
            onClick={(e) => {
              const p = e.points?.[0];
              if (p && p.curveNumber === 1) {
                onSelectRecharge({ date: String(p.x), amount: Number(p.customdata) });
              } else {
                onSelectRecharge(null);
              }
            }}
          />
          {selected && (
            <div className="pointer-events-none absolute right-6 top-6 animate-fade-up rounded-[8px] bg-ink px-2.5 py-1.5 text-panel shadow-sm">
              <p className="font-mono text-xs font-semibold tabular-nums">
                Recharge {bdt(selected.amount)}
              </p>
              <p className="font-mono text-[10px] opacity-70">
                {format(parseISO(selected.date), "d MMM yyyy")}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted">
            <span>{slice[0] && format(parseISO(slice[0].date), "d MMM")}</span>
            <span>Showing last {rangeDays} days</span>
            <span>
              {slice.length > 0 && format(parseISO(slice[slice.length - 1].date), "d MMM")}
            </span>
          </div>
          <input
            type="range"
            min={14}
            max={meterCase.history.length}
            step={1}
            value={rangeDays}
            aria-label="Date range in days"
            onChange={(e) => onRangeChange(Number(e.target.value))}
          />
        </div>
      </div>
    </>
  );
}

export const BalanceChart = memo(BalanceChartInner);
