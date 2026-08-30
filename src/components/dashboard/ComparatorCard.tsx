import { memo, useMemo } from "react";
import { Chart, PLOT_FONT } from "@/components/Chart";
import { Eyebrow, Panel, Slider } from "@/components/ui/controls";
import type { MeterCase } from "@/data/cases";
import { bdt, simulateLowBalance, simulateMonthly } from "@/lib/meter";

export type StrategyParams = {
  threshold: number;
  lowAmount: number;
  monthlyAmount: number;
};

type Props = {
  meterCase: MeterCase;
  dailyUnits: number;
  params: StrategyParams;
  onChange: (patch: Partial<StrategyParams>) => void;
};

const HORIZON = 365;

function ComparatorCardInner({ meterCase, dailyUnits, params, onChange }: Props) {
  const low = useMemo(
    () =>
      simulateLowBalance(
        meterCase,
        { horizonDays: HORIZON, dailyUnits },
        params.threshold,
        params.lowAmount,
      ),
    [meterCase, dailyUnits, params.threshold, params.lowAmount],
  );
  const monthly = useMemo(
    () => simulateMonthly(meterCase, { horizonDays: HORIZON, dailyUnits }, params.monthlyAmount),
    [meterCase, dailyUnits, params.monthlyAmount],
  );

  const monthlyWins = monthly.total <= low.total;
  const savings = Math.abs(monthly.total - low.total);

  const bars = useMemo(
    () =>
      (
        [
          ["Energy", "#c2772a", "energy"],
          ["Fixed", "#a8442a", "fixed"],
          ["VAT", "#4f6b4f", "vat"],
        ] as const
      ).map(([name, color, key]) => ({
        type: "bar" as const,
        name,
        x: ["Low Balance", "Monthly"],
        y: [low[key], monthly[key]],
        marker: { color },
        hovertemplate: `${name} · ৳ %{y:,.0f}<extra></extra>`,
      })),
    [low, monthly],
  );

  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Strategy compare</Eyebrow>
        <span className="rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-medium text-sage">
          {monthlyWins ? "Monthly" : "Low Balance"} saves {bdt(savings)}
        </span>
      </div>

      <div className="mt-2">
        <Chart
          height={150}
          data={bars}
          layout={{
            barmode: "group",
            margin: { l: 44, r: 8, t: 8, b: 26 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: PLOT_FONT,
            showlegend: false,
            bargap: 0.45,
            xaxis: { linecolor: "#e6ddd0" },
            yaxis: { gridcolor: "#e6ddd0", tickprefix: "৳ ", zeroline: false },
            hoverlabel: {
              bgcolor: "#2a241d",
              bordercolor: "#2a241d",
              font: { color: "#fffdf9", family: '"IBM Plex Mono", monospace', size: 11 },
            },
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
        <div className={monthlyWins ? "" : "rounded-[8px] bg-sage/10 -m-1 p-1"}>
          <p className="text-[11px] font-medium text-muted">Low Balance</p>
          <p className="font-mono text-base font-semibold tabular-nums">{bdt(low.total)}</p>
          <p className="font-mono text-[10px] text-muted">{low.recharges} recharges / yr</p>
        </div>
        <div className={monthlyWins ? "rounded-[8px] bg-sage/10 -m-1 p-1" : ""}>
          <p className="text-[11px] font-medium">Monthly</p>
          <p className="font-mono text-base font-semibold tabular-nums">{bdt(monthly.total)}</p>
          <p className="font-mono text-[10px] text-muted">{monthly.recharges} recharges / yr</p>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-line pt-4">
        <Slider
          label="Low Balance · threshold"
          value={params.threshold}
          min={100}
          max={500}
          step={10}
          display={bdt(params.threshold)}
          onChange={(v) => onChange({ threshold: v })}
        />
        <Slider
          label="Low Balance · amount"
          value={params.lowAmount}
          min={500}
          max={5000}
          step={50}
          display={bdt(params.lowAmount)}
          onChange={(v) => onChange({ lowAmount: v })}
        />
        <Slider
          label="Monthly · amount"
          tone="sage"
          value={params.monthlyAmount}
          min={500}
          max={5000}
          step={50}
          display={bdt(params.monthlyAmount)}
          badge={
            monthlyWins ? (
              <span className="rounded-full bg-sage/15 px-1.5 text-[10px] font-medium text-sage">
                cheaper
              </span>
            ) : null
          }
          onChange={(v) => onChange({ monthlyAmount: v })}
        />
      </div>
      {(low.ranDry > 0 || monthly.ranDry > 0) && (
        <p className="mt-3 font-mono text-[10px] text-terracotta">
          Blackout days · Low Balance {low.ranDry} · Monthly {monthly.ranDry}
        </p>
      )}
    </Panel>
  );
}

export const ComparatorCard = memo(ComparatorCardInner);
