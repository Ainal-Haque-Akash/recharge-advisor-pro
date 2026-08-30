import { memo } from "react";
import { format, parseISO } from "date-fns";
import { Panel } from "@/components/ui/controls";
import type { MeterCase } from "@/data/cases";
import { bdt, caseSummary, runOut } from "@/lib/meter";

type Props = {
  meterCase: MeterCase;
  dailyUnits: number;
  hoveredRecharge: string | null;
};

function SummaryTableInner({ meterCase, dailyUnits, hoveredRecharge }: Props) {
  const s = caseSummary(meterCase);
  const ro = runOut(meterCase, dailyUnits);

  const rows: [string, string, string, string][] = [
    ["Opening balance", bdt(s.openingBalance), format(parseISO(meterCase.history[0]!.date), "d MMM"), "start of record"],
    ["Total consumption", `${s.totalUnits.toFixed(0)} units`, `${s.days} days`, `${s.avgDailyUnits.toFixed(1)} /day avg`],
    ["Total recharged", bdt(s.totalRecharged), `${s.days} days`, `${s.rechargeCount} events`],
    ["Current balance", bdt(s.currentBalance), format(parseISO(meterCase.history[s.days - 1]!.date), "d MMM"), `${meterCase.meterType} meter`],
    ["Projected run-out", format(ro.date, "d MMM yyyy"), `at ${dailyUnits.toFixed(1)} u/day`, `${ro.days} days`],
  ];

  const log = [...meterCase.recharges].slice(-8).reverse();

  return (
    <Panel>
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-balance font-display text-xl font-semibold leading-tight">
          Key metrics
        </h2>
        <p className="text-sm text-muted">
          {meterCase.id} · {meterCase.area} · updates with case selection
        </p>
      </div>
      <div className="grid gap-px bg-line lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-x-auto bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                <th className="px-5 py-3 font-medium">Metric</th>
                <th className="px-5 py-3 font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Period</th>
                <th className="px-5 py-3 font-medium">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map(([m, v, p, t]) => (
                <tr key={m} className="transition-colors hover:bg-surface">
                  <td className="px-5 py-3">{m}</td>
                  <td className="px-5 py-3 font-mono font-semibold tabular-nums">{v}</td>
                  <td className="px-5 py-3 text-muted">{p}</td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">{t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto bg-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                <th className="px-5 py-3 font-medium">Recharge</th>
                <th className="px-5 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {log.map((r) => (
                <tr
                  key={r.date}
                  className={
                    hoveredRecharge === r.date
                      ? "bg-amber-soft/50 transition-colors"
                      : "transition-colors hover:bg-surface"
                  }
                >
                  <td className="px-5 py-3 text-muted">
                    {format(parseISO(r.date), "d MMM yyyy")}
                  </td>
                  <td className="px-5 py-3 font-mono font-semibold tabular-nums text-terracotta">
                    ▲ {bdt(r.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

export const SummaryTable = memo(SummaryTableInner);
