import { memo } from "react";
import { format } from "date-fns";
import { Eyebrow, Panel, Slider } from "@/components/ui/controls";
import type { MeterCase } from "@/data/cases";
import { bdt, currentBalance, runOut } from "@/lib/meter";

type Props = {
  meterCase: MeterCase;
  dailyUnits: number;
  onDailyUnits: (v: number) => void;
};

function RunOutCardInner({ meterCase, dailyUnits, onDailyUnits }: Props) {
  const balance = currentBalance(meterCase);
  const { days, date } = runOut(meterCase, dailyUnits);
  const pct = Math.max(2, Math.min(100, (days / 60) * 100));

  return (
    <Panel className="p-5">
      <Eyebrow>Run-out predictor</Eyebrow>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Balance hits zero</p>
          <p className="font-display text-2xl font-semibold leading-tight">
            {format(date, "d MMM yyyy")}
          </p>
        </div>
        <p className="font-mono text-sm font-semibold tabular-nums text-terracotta">
          {days} days left
        </p>
      </div>

      <div className="mt-4">
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-terracotta transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
          <span>0</span>
          <span>{bdt(balance)} on meter</span>
        </div>
      </div>

      <div className="mt-5">
        <Slider
          label="Daily units"
          value={dailyUnits}
          min={0}
          max={50}
          step={0.5}
          display={`${dailyUnits.toFixed(1)} u/day`}
          onChange={onDailyUnits}
        />
      </div>
      <p className="mt-1 font-mono text-[10px] text-muted">
        Usual {meterCase.usualDailyUnits.toFixed(1)} u/day · {bdt(meterCase.tariff.rate, 2)}/unit
      </p>
    </Panel>
  );
}

export const RunOutCard = memo(RunOutCardInner);
