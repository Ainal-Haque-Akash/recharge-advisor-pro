import { memo, useMemo } from "react";
import { Chart, PLOT_FONT } from "@/components/Chart";
import { AnimatedNumber, Eyebrow, Panel } from "@/components/ui/controls";
import type { MeterCase } from "@/data/cases";
import { bdt, requiredRecharge } from "@/lib/meter";

type Props = {
  meterCase: MeterCase;
  dailyUnits: number;
  targetDate: string;
  minDate: string;
  onTargetDate: (v: string) => void;
};

function CalculatorCardInner({
  meterCase,
  dailyUnits,
  targetDate,
  minDate,
  onTargetDate,
}: Props) {
  const req = requiredRecharge(meterCase, dailyUnits, targetDate);

  const donut = useMemo(
    () => [
      {
        type: "pie" as const,
        hole: 0.62,
        values: [req.energy, req.fixed, req.vat],
        labels: ["Energy", "Fixed", "VAT"],
        marker: { colors: ["#c2772a", "#a8442a", "#4f6b4f"], line: { color: "#fffdf9", width: 2 } },
        textinfo: "none" as const,
        sort: false,
        hovertemplate: "%{label} · ৳ %{value:,.0f}<extra></extra>",
      },
    ],
    [req.energy, req.fixed, req.vat],
  );

  return (
    <Panel className="p-5">
      <Eyebrow>Recharge requirement</Eyebrow>

      <div className="mt-3">
        <p className="text-sm text-muted">Target date</p>
        <input
          type="date"
          value={targetDate}
          min={minDate}
          onChange={(e) => e.target.value && onTargetDate(e.target.value)}
          className="mt-1 w-full rounded-[8px] border border-line bg-surface px-3 py-2 text-sm font-medium outline-none focus:border-amber"
        />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">Total required today · {req.days} days</p>
          <p className="font-mono text-3xl font-semibold tabular-nums text-amber">
            <AnimatedNumber value={req.total} format={(n) => bdt(n)} />
          </p>
        </div>
        <div className="size-24 shrink-0">
          <Chart
            height={96}
            data={donut}
            layout={{
              margin: { l: 0, r: 0, t: 0, b: 0 },
              paper_bgcolor: "rgba(0,0,0,0)",
              showlegend: false,
              font: PLOT_FONT,
              hoverlabel: {
                bgcolor: "#2a241d",
                bordercolor: "#2a241d",
                font: { color: "#fffdf9", family: '"IBM Plex Mono", monospace', size: 11 },
              },
            }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-1.5 text-sm">
        {[
          ["Energy", req.energy, "bg-amber"],
          ["Fixed", req.fixed, "bg-terracotta"],
          ["VAT", req.vat, "bg-sage"],
        ].map(([label, value, dot]) => (
          <div key={label as string} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${dot}`} />
            <span className="text-muted">{label as string}</span>
            <span className="ml-auto font-mono font-semibold tabular-nums">
              {bdt(value as number)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export const CalculatorCard = memo(CalculatorCardInner);
