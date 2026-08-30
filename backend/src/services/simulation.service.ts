import { addDays, differenceInCalendarDays, parseISO } from "date-fns";

export interface TariffParams {
  rate: number;
  meterRent: number;
  demandCharge: number;
  vatRate: number;
}

export interface CostBreakdown {
  energy: number;
  fixed: number;
  vat: number;
  total: number;
}

export function dailyEnergyCost(units: number, tariff: TariffParams): number {
  return units * tariff.rate;
}

export function creditFromRecharge(amount: number, tariff: TariffParams) {
  const fees = tariff.meterRent + tariff.demandCharge;
  const taxable = Math.max(0, amount - fees);
  const vat = taxable * tariff.vatRate;
  return {
    credit: Math.max(0, amount - fees - vat),
    fees,
    vat,
  };
}

export function grossForCredit(credit: number, tariff: TariffParams): number {
  const fees = tariff.meterRent + tariff.demandCharge;
  return credit / (1 - tariff.vatRate) + fees;
}

export function calculateRunOut(
  currentBalance: number,
  lastDateISO: string,
  dailyUnits: number,
  tariff: TariffParams,
) {
  const perDay = dailyEnergyCost(Math.max(0.1, dailyUnits), tariff);
  const days = Math.max(0, Math.floor(currentBalance / perDay));
  const runOutDate = addDays(parseISO(lastDateISO), days);
  return {
    days,
    perDay,
    runOutDate: runOutDate.toISOString().slice(0, 10),
  };
}

export function calculateRequiredRecharge(
  currentBalance: number,
  lastDateISO: string,
  dailyUnits: number,
  targetDateISO: string,
  tariff: TariffParams,
): CostBreakdown & { days: number } {
  const last = parseISO(lastDateISO);
  const days = Math.max(0, differenceInCalendarDays(parseISO(targetDateISO), last));
  const needCredit = Math.max(0, days * dailyEnergyCost(dailyUnits, tariff) - currentBalance);
  if (needCredit <= 0) {
    return { energy: 0, fixed: 0, vat: 0, total: 0, days };
  }

  const gross = grossForCredit(needCredit, tariff);
  const fixed = tariff.meterRent + tariff.demandCharge;
  const vat = (gross - fixed) * tariff.vatRate;
  return { energy: needCredit, fixed, vat, total: gross, days };
}

export interface StrategyResult extends CostBreakdown {
  recharges: number;
  ranDry: number;
}

function settle(
  tariff: TariffParams,
  gross: number,
  recharges: number,
  energy: number,
  leftoverCredit: number,
): StrategyResult {
  const fixed = recharges * (tariff.meterRent + tariff.demandCharge);
  const vat = Math.max(0, gross - fixed) * tariff.vatRate;
  const total = Math.max(0, gross - leftoverCredit);
  return { energy, fixed, vat, total, recharges, ranDry: 0 };
}

export function simulateLowBalance(
  startingBalance: number,
  dailyUnits: number,
  tariff: TariffParams,
  horizonDays: number,
  threshold: number,
  amount: number,
): StrategyResult {
  const perDay = dailyEnergyCost(dailyUnits, tariff);
  let balance = startingBalance;
  let gross = 0;
  let count = 0;
  let energy = 0;
  let ranDry = 0;

  for (let d = 0; d < horizonDays; d++) {
    if (balance < threshold) {
      gross += amount;
      count += 1;
      balance += creditFromRecharge(amount, tariff).credit;
    }
    if (balance < perDay) ranDry += 1;
    balance -= perDay;
    energy += perDay;
    if (balance < 0) balance = 0;
  }

  const res = settle(tariff, gross, count, energy, balance);
  res.ranDry = ranDry;
  return res;
}

export function simulateMonthly(
  startingBalance: number,
  startDateISO: string,
  dailyUnits: number,
  tariff: TariffParams,
  horizonDays: number,
  monthlyAmount: number,
): StrategyResult {
  const perDay = dailyEnergyCost(dailyUnits, tariff);
  const start = parseISO(startDateISO);
  let balance = startingBalance;
  let gross = 0;
  let count = 0;
  let energy = 0;
  let ranDry = 0;

  for (let d = 0; d < horizonDays; d++) {
    const day = addDays(start, d);
    if (d === 0 || day.getDate() === 1) {
      gross += monthlyAmount;
      count += 1;
      balance += creditFromRecharge(monthlyAmount, tariff).credit;
    }
    if (balance < perDay) ranDry += 1;
    balance -= perDay;
    energy += perDay;
    if (balance < 0) balance = 0;
  }

  const res = settle(tariff, gross, count, energy, balance);
  res.ranDry = ranDry;
  return res;
}
