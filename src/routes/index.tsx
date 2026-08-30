import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { CASES, TODAY } from "@/data/cases";
import { bdt, caseSummary } from "@/lib/meter";
import { Eyebrow, Panel } from "@/components/ui/controls";
import { BalanceChart } from "@/components/dashboard/BalanceChart";
import { RunOutCard } from "@/components/dashboard/RunOutCard";
import { CalculatorCard } from "@/components/dashboard/CalculatorCard";
import { ComparatorCard, type StrategyParams } from "@/components/dashboard/ComparatorCard";
import { SummaryTable } from "@/components/dashboard/SummaryTable";

const title = "Vajra Meter · Prepaid Recharge Advisor";
const description =
  "Simulate prepaid electricity meter balances, predict run-out dates and compare low-balance vs monthly recharge strategies across 25 sample cases.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const defaultsFor = (id: string): StrategyParams => {
  const c = CASES.find((x) => x.id === id)!;
  const monthly = Math.min(
    5000,
    Math.max(500, Math.round((c.usualDailyUnits * c.tariff.rate * 30) / 50) * 50),
  );
  return { threshold: 300, lowAmount: Math.min(5000, Math.max(500, monthly)), monthlyAmount: monthly };
};

function Dashboard() {
  const [caseId, setCaseId] = useState(CASES[0].id);
  const meterCase = useMemo(() => CASES.find((c) => c.id === caseId)!, [caseId]);

  const [rangeDays, setRangeDays] = useState(90);
  const [dailyUnits, setDailyUnits] = useState(CASES[0].usualDailyUnits);
  const [targetDate, setTargetDate] = useState(
    format(addDays(parseISO(TODAY), 30), "yyyy-MM-dd"),
  );
  const [params, setParams] = useState<StrategyParams>(() => defaultsFor(CASES[0].id));
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ date: string; amount: number } | null>(null);

  const applyCase = useCallback((id: string) => {
    const c = CASES.find((x) => x.id === id)!;
    setCaseId(id);
    setDailyUnits(c.usualDailyUnits);
    setParams(defaultsFor(id));
    setSelected(null);
    setHovered(null);
  }, []);

  const reset = useCallback(() => {
    setRangeDays(90);
    setDailyUnits(meterCase.usualDailyUnits);
    setTargetDate(format(addDays(parseISO(TODAY), 30), "yyyy-MM-dd"));
    setParams(defaultsFor(meterCase.id));
    setSelected(null);
  }, [meterCase]);

  const patchParams = useCallback(
    (patch: Partial<StrategyParams>) => setParams((p) => ({ ...p, ...patch })),
    [],
  );

  const s = caseSummary(meterCase);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-[10px] bg-amber">
              <span className="font-display text-sm font-semibold text-panel">V</span>
            </div>
            <div className="leading-tight">
              <h1 className="font-display text-[15px] font-semibold">Vajra Meter</h1>
              <p className="text-[11px] text-muted">Recharge advisor</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <select
              value={caseId}
              aria-label="Select case"
              onChange={(e) => applyCase(e.target.value)}
              className="rounded-[10px] border border-line bg-surface px-3 py-2 text-sm font-medium outline-none focus:border-amber"
            >
              {CASES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              onClick={reset}
              className="rounded-[10px] border border-line bg-panel px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-amber hover:text-ink"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="border-t border-line">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
            {[
              ["Opening balance", bdt(s.openingBalance), ""],
              ["Total consumption", s.totalUnits.toFixed(0), "units"],
              ["Total recharged", bdt(s.totalRecharged), ""],
              ["Recharges", String(s.rechargeCount), ""],
            ].map(([label, value, unit]) => (
              <div key={label} className="bg-panel px-5 py-3">
                <Eyebrow>{label}</Eyebrow>
                <p className="font-mono text-lg font-semibold tabular-nums">
                  {value} {unit && <span className="text-xs text-muted">{unit}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main key={caseId} className="mx-auto max-w-7xl animate-fade-up space-y-5 px-5 py-6">
        <Panel>
          <BalanceChart
            meterCase={meterCase}
            rangeDays={rangeDays}
            onRangeChange={setRangeDays}
            onHoverRecharge={setHovered}
            selected={selected}
            onSelectRecharge={setSelected}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <RunOutCard
            meterCase={meterCase}
            dailyUnits={dailyUnits}
            onDailyUnits={setDailyUnits}
          />
          <CalculatorCard
            meterCase={meterCase}
            dailyUnits={dailyUnits}
            targetDate={targetDate}
            minDate={TODAY}
            onTargetDate={setTargetDate}
          />
          <ComparatorCard
            meterCase={meterCase}
            dailyUnits={dailyUnits}
            params={params}
            onChange={patchParams}
          />
        </div>

        <SummaryTable
          meterCase={meterCase}
          dailyUnits={dailyUnits}
          hoveredRecharge={hovered}
        />
      </main>
    </div>
  );
}
