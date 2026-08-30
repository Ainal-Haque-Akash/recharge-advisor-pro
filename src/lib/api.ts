export const API_BASE = "/api";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vajra_auth_token");
}

export function setAuthToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("vajra_auth_token", token);
  } else {
    localStorage.removeItem("vajra_auth_token");
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}: ${response.statusText}`);
  }

  return data as T;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface Tariff {
  rate: number;
  meterRent: number;
  demandCharge: number;
  vatRate: number;
}

export interface DayPoint {
  date: string;
  balance: number;
  units: number;
}

export interface RechargeEvent {
  id?: string;
  date: string;
  amount: number;
  fees?: number;
  vat?: number;
  credit?: number;
  notes?: string;
}

export interface MeterCase {
  id: string;
  label: string;
  area: string;
  meterNumber?: string;
  meterType: "Residential" | "Commercial" | "Mixed";
  openingBalance: number;
  currentBalance?: number;
  usualDailyUnits: number;
  tariff: Tariff;
  history: DayPoint[];
  recharges: RechargeEvent[];
  isBenchmark?: boolean;
  isOwner?: boolean;
}

export interface CreateMeterPayload {
  label: string;
  meterNumber?: string;
  area: string;
  meterType: "Residential" | "Commercial" | "Mixed";
  openingBalance: number;
  usualDailyUnits: number;
  rate: number;
  meterRent?: number;
  demandCharge?: number;
  vatRate?: number;
}

export const api = {
  auth: {
    login: (credentials: { email: string; password: string }) =>
      request<{ message: string; token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    register: (data: { name: string; email: string; password: string }) =>
      request<{ message: string; token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    me: () => request<{ user: User }>("/auth/me"),
  },

  meters: {
    list: () => request<{ meters: MeterCase[] }>("/meters"),
    get: (id: string) => request<{ meter: MeterCase }>(`/meters/${id}`),
    create: (data: CreateMeterPayload) =>
      request<{ message: string; meter: MeterCase }>("/meters", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<CreateMeterPayload>) =>
      request<{ message: string; meter: MeterCase }>(`/meters/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ message: string }>(`/meters/${id}`, {
        method: "DELETE",
      }),
    recharge: (id: string, data: { amount: number; date?: string; notes?: string }) =>
      request<{ message: string; recharge: RechargeEvent; currentBalance: number }>(
        `/meters/${id}/recharges`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    recordReading: (id: string, data: { units: number; date?: string }) =>
      request<{ message: string; reading: DayPoint; currentBalance: number }>(
        `/meters/${id}/readings`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
  },

  simulations: {
    runOut: (params: {
      currentBalance: number;
      lastDate: string;
      dailyUnits: number;
      tariff: Tariff;
    }) =>
      request<{ days: number; perDay: number; runOutDate: string }>("/simulations/run-out", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    requiredRecharge: (params: {
      currentBalance: number;
      lastDate: string;
      dailyUnits: number;
      targetDate: string;
      tariff: Tariff;
    }) =>
      request<{
        energy: number;
        fixed: number;
        vat: number;
        total: number;
        days: number;
      }>("/simulations/required-recharge", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    compare: (params: {
      currentBalance: number;
      startDate: string;
      dailyUnits: number;
      tariff: Tariff;
      horizonDays?: number;
      threshold: number;
      lowAmount: number;
      monthlyAmount: number;
    }) =>
      request<{
        low: { energy: number; fixed: number; vat: number; total: number; recharges: number; ranDry: number };
        monthly: { energy: number; fixed: number; vat: number; total: number; recharges: number; ranDry: number };
        cheaper: "low" | "monthly" | "equal";
        savings: number;
      }>("/simulations/compare", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    save: (data: {
      name: string;
      meterId?: string;
      threshold: number;
      lowAmount: number;
      monthlyAmount: number;
      targetDate?: string;
      resultJson: string;
    }) =>
      request<{ message: string; simulation: any }>("/simulations/save", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    list: () => request<{ simulations: any[] }>("/simulations"),
  },
};
