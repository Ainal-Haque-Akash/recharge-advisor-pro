import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useMemo, useState, useEffect } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CASES, TODAY } from "@/data/cases";
import { bdt, caseSummary } from "@/lib/meter";
import { api, type MeterCase } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Eyebrow, Panel } from "@/components/ui/controls";
import { BalanceChart } from "@/components/dashboard/BalanceChart";
import { RunOutCard } from "@/components/dashboard/RunOutCard";
import { CalculatorCard } from "@/components/dashboard/CalculatorCard";
import { ComparatorCard, type StrategyParams } from "@/components/dashboard/ComparatorCard";
import { SummaryTable } from "@/components/dashboard/SummaryTable";
import { AuthModal } from "@/components/auth/AuthModal";
import { AddMeterModal } from "@/components/meters/AddMeterModal";
import { AddRechargeModal } from "@/components/meters/AddRechargeModal";
import { firebaseService } from "@/lib/firebase-service";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, User, Plus, Zap, LogOut, Shield, CheckCircle2 } from "lucide-react";

const title = "Meter Trace · Prepaid Recharge Advisor";
const description =
  "Simulate prepaid electricity meter balances, predict run-out dates and compare low-balance vs monthly recharge strategies with backend database sync & authentication.";

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

const defaultsFor = (c: MeterCase): StrategyParams => {
  const monthly = Math.min(
    5000,
    Math.max(500, Math.round((c.usualDailyUnits * c.tariff.rate * 30) / 50) * 50),
  );
  return { threshold: 300, lowAmount: Math.min(5000, Math.max(500, monthly)), monthlyAmount: monthly };
};

function Dashboard() {
  const { user, isAuthenticated, logout, signInWithGoogle } = useAuth();
  const queryClient = useQueryClient();

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState<"login" | "register">("login");
  const [addMeterModalOpen, setAddMeterModalOpen] = useState(false);
  const [rechargeModalOpen, setRechargeModalOpen] = useState(false);

  // Meter selection
  const [caseId, setCaseId] = useState<string>("CASE-001");

  // Fetch meters list from Firebase Firestore (including benchmark cases + user's meters)
  const { data: metersData, isLoading: isMetersLoading } = useQuery({
    queryKey: ["meters", user?.uid],
    queryFn: async () => {
      try {
        const meters = await firebaseService.getMeters(user?.uid);
        return meters;
      } catch (err) {
        console.warn("Firestore unavailable, using fallback benchmark cases:", err);
        return CASES;
      }
    },
    staleTime: 1000 * 30, // 30s
  });

  const allMeters = useMemo<MeterCase[]>(() => {
    if (metersData && metersData.length > 0) {
      return metersData;
    }
    return CASES;
  }, [metersData]);

  // Separate custom meters vs benchmark cases
  const userMeters = useMemo(() => allMeters.filter((m) => !m.isBenchmark && m.isOwner), [allMeters]);
  const benchmarkMeters = useMemo(() => allMeters.filter((m) => m.isBenchmark !== false), [allMeters]);

  // Fetch full details of the currently selected meter from Firestore (including live recharges & history)
  const { data: currentMeterData } = useQuery({
    queryKey: ["meter", caseId, user?.uid],
    queryFn: async () => {
      try {
        const meter = await firebaseService.getMeter(caseId, user?.uid);
        return meter;
      } catch {
        return allMeters.find((c) => c.id === caseId) || CASES[0]!;
      }
    },
    enabled: Boolean(caseId),
  });

  const activeMeter = useMemo<MeterCase>(() => {
    if (currentMeterData && currentMeterData.id === caseId) {
      return currentMeterData;
    }
    const found = allMeters.find((c) => c.id === caseId);
    if (found) return found;
    return CASES[0]!;
  }, [currentMeterData, allMeters, caseId]);

  // Parameters
  const [rangeDays, setRangeDays] = useState(90);
  const [dailyUnits, setDailyUnits] = useState(activeMeter.usualDailyUnits);
  const [targetDate, setTargetDate] = useState(
    format(addDays(parseISO(TODAY), 30), "yyyy-MM-dd"),
  );
  const [params, setParams] = useState<StrategyParams>(() => defaultsFor(activeMeter));
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ date: string; amount: number } | null>(null);

  // Sync dailyUnits & params when case changes
  useEffect(() => {
    setDailyUnits(activeMeter.usualDailyUnits);
    setParams(defaultsFor(activeMeter));
    setSelected(null);
    setHovered(null);
  }, [activeMeter.id, activeMeter.usualDailyUnits]);

  const applyCase = useCallback(
    (id: string) => {
      setCaseId(id);
    },
    [],
  );

  const reset = useCallback(() => {
    setRangeDays(90);
    setDailyUnits(activeMeter.usualDailyUnits);
    setTargetDate(format(addDays(parseISO(TODAY), 30), "yyyy-MM-dd"));
    setParams(defaultsFor(activeMeter));
    setSelected(null);
  }, [activeMeter]);

  const patchParams = useCallback(
    (patch: Partial<StrategyParams>) => setParams((p) => ({ ...p, ...patch })),
    [],
  );

  const handleMeterCreated = (newMeterId: string) => {
    queryClient.invalidateQueries({ queryKey: ["meters"] });
    setCaseId(newMeterId);
  };

  const handleRechargeCompleted = () => {
    queryClient.invalidateQueries({ queryKey: ["meters"] });
    queryClient.invalidateQueries({ queryKey: ["meter", caseId] });
  };

  const s = caseSummary(activeMeter);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-20 border-b border-line bg-panel/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-[10px] bg-amber shadow-sm">
              <span className="font-display text-sm font-semibold text-panel">M</span>
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[15px] font-semibold">Meter Trace</h1>
                <span className="rounded bg-amber/10 px-1.5 py-0.5 text-[10px] font-medium text-amber border border-amber/20">
                  Pro
                </span>
              </div>
              <p className="text-[11px] text-muted">Prepaid electricity recharge advisor</p>
            </div>
          </div>

          {/* Actions & Navigation */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Action: Add Recharge */}
            <Button
              size="sm"
              onClick={() => {
                if (!isAuthenticated) {
                  setAuthDefaultTab("login");
                  setAuthModalOpen(true);
                } else {
                  setRechargeModalOpen(true);
                }
              }}
              className="bg-amber text-panel hover:bg-amber/90 font-medium text-xs h-8 px-2.5 shadow-sm"
            >
              <Zap className="size-3.5 mr-1" />
              Quick Recharge
            </Button>

            {/* Case / Meter Selector */}
            <div className="relative">
              <select
                value={caseId}
                aria-label="Select meter case"
                onChange={(e) => applyCase(e.target.value)}
                className="h-8 max-w-[180px] sm:max-w-[240px] truncate rounded-[8px] border border-line bg-surface px-2.5 text-xs font-medium outline-none focus:border-amber"
              >
                {userMeters.length > 0 && (
                  <optgroup label="🌟 My Saved Meters">
                    {userMeters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.area})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="📊 Sample Benchmark Cases (Dhaka)">
                  {benchmarkMeters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={reset}
              className="rounded-[8px] border border-line bg-panel px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-amber hover:text-ink hidden md:inline-block"
            >
              Reset
            </button>

            {/* Authentication & User Dropdown */}
            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 border-line bg-surface hover:bg-panel flex items-center gap-1.5 px-2 text-xs"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.name}
                        className="size-5 rounded-full object-cover border border-amber/40"
                      />
                    ) : (
                      <div className="grid size-5 place-items-center rounded-full bg-amber/20 text-amber font-semibold text-[10px]">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="max-w-[80px] truncate font-medium">{user.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-panel border-line text-ink">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-semibold leading-none">{user.name}</p>
                      <p className="text-[11px] leading-none text-muted">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-line" />
                  <DropdownMenuItem
                    onClick={() => setAddMeterModalOpen(true)}
                    className="cursor-pointer text-xs focus:bg-amber/10 focus:text-amber"
                  >
                    <Plus className="size-3.5 mr-2 text-amber" />
                    Add New Meter
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setRechargeModalOpen(true)}
                    className="cursor-pointer text-xs focus:bg-amber/10 focus:text-amber"
                  >
                    <Zap className="size-3.5 mr-2 text-amber" />
                    Record Recharge
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-line" />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-xs text-rose-400 focus:bg-rose-500/10 focus:text-rose-400"
                  >
                    <LogOut className="size-3.5 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => signInWithGoogle()}
                  className="h-8 border-line hover:border-amber/60 bg-surface hover:bg-panel text-xs px-2.5 flex items-center gap-1.5"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Google Sign In</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setAuthDefaultTab("login");
                    setAuthModalOpen(true);
                  }}
                  className="h-8 bg-amber text-panel hover:bg-amber/90 font-medium text-xs px-2.5"
                >
                  <LogIn className="size-3.5 mr-1" />
                  Sign In
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live Metrics Ribbon */}
        <div className="border-t border-line">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-4">
            {[
              ["Opening balance", bdt(s.openingBalance), ""],
              ["Total consumption", s.totalUnits.toFixed(0), "units"],
              ["Total recharged", bdt(s.totalRecharged), ""],
              ["Recharges logged", String(s.rechargeCount), ""],
            ].map(([label, value, unit]) => (
              <div key={label} className="bg-panel px-5 py-2.5">
                <Eyebrow>{label}</Eyebrow>
                <p className="font-mono text-base sm:text-lg font-semibold tabular-nums">
                  {value} {unit && <span className="text-xs text-muted">{unit}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Main Dashboard Body */}
      <main key={caseId} className="mx-auto max-w-7xl animate-fade-up space-y-5 px-5 py-6">
        {/* Custom meter indicator */}
        {!activeMeter.isBenchmark && (
          <div className="flex items-center justify-between rounded-lg border border-amber/30 bg-amber/5 px-4 py-2.5 text-xs text-ink">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-amber" />
              <span>
                Viewing custom meter: <strong className="font-semibold">{activeMeter.label}</strong> (
                {activeMeter.area}) · Meter No:{" "}
                <span className="font-mono text-amber">{activeMeter.meterNumber || "N/A"}</span>
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRechargeModalOpen(true)}
              className="h-7 border-amber/40 bg-amber/10 text-amber hover:bg-amber/20 text-xs"
            >
              <Zap className="size-3 mr-1" /> Log Recharge
            </Button>
          </div>
        )}

        <Panel>
          <BalanceChart
            meterCase={activeMeter}
            rangeDays={rangeDays}
            onRangeChange={setRangeDays}
            onHoverRecharge={setHovered}
            selected={selected}
            onSelectRecharge={setSelected}
          />
        </Panel>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <RunOutCard
            meterCase={activeMeter}
            dailyUnits={dailyUnits}
            onDailyUnits={setDailyUnits}
          />
          <CalculatorCard
            meterCase={activeMeter}
            dailyUnits={dailyUnits}
            targetDate={targetDate}
            minDate={TODAY}
            onTargetDate={setTargetDate}
          />
          <ComparatorCard
            meterCase={activeMeter}
            dailyUnits={dailyUnits}
            params={params}
            onChange={patchParams}
          />
        </div>

        <SummaryTable
          meterCase={activeMeter}
          dailyUnits={dailyUnits}
          hoveredRecharge={hovered}
        />
      </main>

      {/* Dialog Modals */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        defaultTab={authDefaultTab}
      />
      <AddMeterModal
        open={addMeterModalOpen}
        onOpenChange={setAddMeterModalOpen}
        onMeterCreated={handleMeterCreated}
      />
      <AddRechargeModal
        open={rechargeModalOpen}
        onOpenChange={setRechargeModalOpen}
        meter={activeMeter}
        onRechargeComplete={handleRechargeCompleted}
      />
    </div>
  );
}
