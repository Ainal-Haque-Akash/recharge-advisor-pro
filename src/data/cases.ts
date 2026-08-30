export type RechargeEvent = {
  date: string; // yyyy-MM-dd
  amount: number;
};

export type DayPoint = {
  date: string;
  balance: number;
  units: number;
};

export type Tariff = {
  /** BDT per kWh */
  rate: number;
  /** deducted at every recharge */
  meterRent: number;
  /** deducted at every recharge */
  demandCharge: number;
  /** e.g. 0.05 */
  vatRate: number;
};

export type MeterCase = {
  id: string;
  label: string;
  area: string;
  meterType: "Residential" | "Commercial" | "Mixed";
  openingBalance: number;
  usualDailyUnits: number;
  tariff: Tariff;
  history: DayPoint[];
  recharges: RechargeEvent[];
};

/** Fixed anchor so server and client render identical data. */
export const TODAY = "2026-08-30";

const AREAS = [
  "North Ward",
  "Riverside",
  "Old Town",
  "Mirpur",
  "Uttara",
  "Dhanmondi",
  "Banani",
  "Gulshan",
  "Motijheel",
  "Bashundhara",
  "Savar",
  "Tongi",
  "Narayanganj",
  "Keraniganj",
  "Jatrabari",
  "Mohammadpur",
  "Badda",
  "Rampura",
  "Shyamoli",
  "Khilgaon",
  "Cantonment",
  "Wari",
  "Lalbagh",
  "Kamrangirchar",
  "Demra",
];

const TYPES: MeterCase["meterType"][] = ["Residential", "Commercial", "Mixed"];

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const HISTORY_DAYS = 180;

function buildCase(i: number): MeterCase {
  const r = rng(1000 + i * 77);
  const meterType = TYPES[i % 3];
  const commercialBoost = meterType === "Commercial" ? 2.1 : meterType === "Mixed" ? 1.4 : 1;
  const usualDailyUnits = Math.round((6 + r() * 14) * commercialBoost * 10) / 10;
  const rate = Math.round((6.4 + r() * 4.6) * 100) / 100;
  const tariff: Tariff = {
    rate,
    meterRent: [40, 45, 60, 85][Math.floor(r() * 4)],
    demandCharge: Math.round((25 + r() * 60) / 5) * 5,
    vatRate: 0.05,
  };

  const start = addDaysISO(TODAY, -(HISTORY_DAYS - 1));
  const openingBalance = Math.round((600 + r() * 2600) / 10) * 10;

  const history: DayPoint[] = [];
  const recharges: RechargeEvent[] = [];

  let balance = openingBalance;
  const threshold = Math.round((120 + r() * 300) / 10) * 10;
  const topUp = Math.round((800 + r() * 3000) / 100) * 100;

  for (let d = 0; d < HISTORY_DAYS; d++) {
    const date = addDaysISO(start, d);
    if (balance < threshold) {
      const amount = Math.round((topUp * (0.8 + r() * 0.5)) / 50) * 50;
      const fees = tariff.meterRent + tariff.demandCharge;
      const vat = (amount - fees) * tariff.vatRate;
      balance += amount - fees - vat;
      recharges.push({ date, amount });
    }
    const weekday = new Date(date + "T00:00:00Z").getUTCDay();
    const weekendFactor = weekday === 5 || weekday === 6 ? 1.12 : 1;
    const units = Math.max(
      0.5,
      Math.round(usualDailyUnits * weekendFactor * (0.78 + r() * 0.44) * 10) / 10,
    );
    balance = Math.max(0, Math.round((balance - units * rate) * 100) / 100);
    history.push({ date, balance: Math.round(balance * 100) / 100, units });
  }

  const n = String(i + 1).padStart(3, "0");
  return {
    id: `CASE-${n}`,
    label: `CASE-${n} · ${AREAS[i]}`,
    area: AREAS[i],
    meterType,
    openingBalance,
    usualDailyUnits,
    tariff,
    history,
    recharges,
  };
}

export const CASES: MeterCase[] = Array.from({ length: 25 }, (_, i) => buildCase(i));
