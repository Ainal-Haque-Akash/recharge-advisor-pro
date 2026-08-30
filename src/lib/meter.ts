import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import type { MeterCase, Tariff } from "@/data/cases";

export type CostBreakdown = {
  energy: number;
  fixed: number;
  vat: number;
  total: number;
};

export const emptyBreakdown = (): CostBreakdown => ({ energy: 0, fixed: 0, vat: 0, total: 0 });

/** Daily energy cost in BDT for a given consumption. */
export function dailyEnergyCost(units: number, tariff: Tariff) {
  return units * tariff.rate;
}

/** Credit actually added to the meter after per-recharge fees and VAT. */
export function creditFromRecharge(amount: number, tariff: Tariff) {
  const fees = tariff.meterRent + tariff.demandCharge;
  const taxable = Math.max(0, amount - fees);
  const vat = taxable * tariff.vatRate;
  return { credit: Math.max(0, amount - fees - vat), fees, vat };
}

/** Gross recharge needed so that `credit` BDT lands on the meter. */
export function grossForCredit(credit: number, tariff: Tariff) {
  const fees = tariff.meterRent + tariff.demandCharge;
  return credit / (1 - tariff.vatRate) + fees;
}

export function currentBalance(c: MeterCase) {
  return c.history[c.history.length - 1]?.balance ?? 0;
}

export function runOut(c: MeterCase, dailyUnits: number) {
  const balance = currentBalance(c);
  const perDay = dailyEnergyCost(Math.max(0.1, dailyUnits), c.tariff);
  const days = Math.max(0, Math.floor(balance / perDay));
  return {
    days,
    perDay,
    date: addDays(parseISO(c.history[c.history.length - 1].date), days),
  };
}

/** Recharge required today so the meter survives until (and including) the target date. */
export function requiredRecharge(
  c: MeterCase,
  dailyUnits: number,
  targetISO: string,
): CostBreakdown & { days: number } {
  const last = parseISO(c.history[c.history.length - 1].date);
  const days = Math.max(0, differenceInCalendarDays(parseISO(targetISO), last));
  const needCredit = Math.max(0, days * dailyEnergyCost(dailyUnits, c.tariff) - currentBalance(c));
  if (needCredit <= 0) return { ...emptyBreakdown(), days };

  const gross = grossForCredit(needCredit, c.tariff);
  const fixed = c.tariff.meterRent + c.tariff.demandCharge;
  const vat = (gross - fixed) * c.tariff.vatRate;
  return { energy: needCredit, fixed, vat, total: gross, days };
}

export type StrategyResult = CostBreakdown & {
  recharges: number;
  ranDry: number;
};

type SimOptions = {
  horizonDays: number;
  dailyUnits: number;
};

function settle(
  c: MeterCase,
  gross: number,
  recharges: number,
  energy: number,
  leftoverCredit: number,
): StrategyResult {
  const fixed = recharges * (c.tariff.meterRent + c.tariff.demandCharge);
  const vat = Math.max(0, gross - fixed) * c.tariff.vatRate;
  const total = Math.max(0, gross - leftoverCredit);
  return { energy, fixed, vat, total, recharges, ranDry: 0 };
}

export function simulateLowBalance(
  c: MeterCase,
  { horizonDays, dailyUnits }: SimOptions,
  threshold: number,
  amount: number,
): StrategyResult {
  const perDay = dailyEnergyCost(dailyUnits, c.tariff);
  let balance = currentBalance(c);
  let gross = 0;
  let count = 0;
  let energy = 0;
  let ranDry = 0;

  for (let d = 0; d < horizonDays; d++) {
    if (balance < threshold) {
      gross += amount;
      count += 1;
      balance += creditFromRecharge(amount, c.tariff).credit;
    }
    if (balance < perDay) ranDry += 1;
    balance -= perDay;
    energy += perDay;
    if (balance < 0) balance = 0;
  }
  const res = settle(c, gross, count, energy, balance);
  res.ranDry = ranDry;
  return res;
}

export function simulateMonthly(
  c: MeterCase,
  { horizonDays, dailyUnits }: SimOptions,
  monthlyAmount: number,
): StrategyResult {
  const perDay = dailyEnergyCost(dailyUnits, c.tariff);
  const start = parseISO(c.history[c.history.length - 1].date);
  let balance = currentBalance(c);
  let gross = 0;
  let count = 0;
  let energy = 0;
  let ranDry = 0;

  for (let d = 0; d < horizonDays; d++) {
    const day = addDays(start, d);
    if (d === 0 || day.getDate() === 1) {
      gross += monthlyAmount;
      count += 1;
      balance += creditFromRecharge(monthlyAmount, c.tariff).credit;
    }
    if (balance < perDay) ranDry += 1;
    balance -= perDay;
    energy += perDay;
    if (balance < 0) balance = 0;
  }
  const res = settle(c, gross, count, energy, balance);
  res.ranDry = ranDry;
  return res;
}

export function caseSummary(c: MeterCase) {
  const totalUnits = c.history.reduce((s, d) => s + d.units, 0);
  const totalRecharged = c.recharges.reduce((s, r) => s + r.amount, 0);
  return {
    openingBalance: c.openingBalance,
    totalUnits,
    totalRecharged,
    avgDailyUnits: totalUnits / c.history.length,
    rechargeCount: c.recharges.length,
    currentBalance: currentBalance(c),
    days: c.history.length,
  };
}

export const bdt = (n: number, digits = 0) =>
  `৳ ${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
