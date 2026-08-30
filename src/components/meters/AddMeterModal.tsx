import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { firebaseService } from "@/lib/firebase-service";
import type { CreateMeterPayload } from "@/lib/api";
import { toast } from "sonner";
import { Gauge, Zap, DollarSign, MapPin, Layers } from "lucide-react";

interface AddMeterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMeterCreated: (meterId: string) => void;
}

const COMMON_AREAS = [
  "Dhanmondi",
  "Mirpur",
  "Uttara",
  "Banani",
  "Gulshan",
  "Mohammadpur",
  "Bashundhara",
  "Badda",
  "Rampura",
  "Old Town",
  "Khilgaon",
  "Savar",
  "Narayanganj",
];

export function AddMeterModal({ open, onOpenChange, onMeterCreated }: AddMeterModalProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [label, setLabel] = useState("");
  const [meterNumber, setMeterNumber] = useState("");
  const [area, setArea] = useState("Dhanmondi");
  const [customArea, setCustomArea] = useState("");
  const [meterType, setMeterType] = useState<"Residential" | "Commercial" | "Mixed">("Residential");
  const [openingBalance, setOpeningBalance] = useState("1000");
  const [usualDailyUnits, setUsualDailyUnits] = useState("8.0");
  const [rate, setRate] = useState("7.20");
  const [meterRent, setMeterRent] = useState("40");
  const [demandCharge, setDemandCharge] = useState("35");
  const [vatRate, setVatRate] = useState("5");

  const reset = () => {
    setLabel("");
    setMeterNumber("");
    setArea("Dhanmondi");
    setCustomArea("");
    setMeterType("Residential");
    setOpeningBalance("1000");
    setUsualDailyUnits("8.0");
    setRate("7.20");
    setMeterRent("40");
    setDemandCharge("35");
    setVatRate("5");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("Please sign in to add a custom meter.");
      return;
    }

    const chosenArea = area === "custom" ? customArea.trim() : area;
    if (!label.trim()) {
      setError("Meter label is required.");
      return;
    }
    if (!chosenArea) {
      setError("Please specify an area or location.");
      return;
    }

    const payload: CreateMeterPayload = {
      label: label.trim(),
      meterNumber: meterNumber.trim() || undefined,
      area: chosenArea,
      meterType,
      openingBalance: parseFloat(openingBalance) || 0,
      usualDailyUnits: parseFloat(usualDailyUnits) || 5,
      rate: parseFloat(rate) || 7.2,
      meterRent: parseFloat(meterRent) || 40,
      demandCharge: parseFloat(demandCharge) || 35,
      vatRate: (parseFloat(vatRate) || 5) / 100,
    };

    try {
      setIsSubmitting(true);
      const newMeter = await firebaseService.createMeter(user.uid, payload);
      toast.success(`Meter "${newMeter.label}" added to Firestore!`);
      onMeterCreated(newMeter.id);
      onOpenChange(false);
      reset();
    } catch (err: any) {
      setError(err.message || "Failed to create meter.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] border-line bg-panel text-ink p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-[8px] bg-amber text-panel">
              <Gauge className="size-4" />
            </div>
            <DialogTitle className="font-display text-lg font-semibold">
              Add New Prepaid Meter
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted">
            Configure your prepaid electricity meter details and custom tariff structure.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <Gauge className="size-3.5 text-amber" /> Meter Name / Label *
              </Label>
              <Input
                placeholder="e.g. My Apartment Main"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                className="bg-surface border-line text-sm h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <Layers className="size-3.5 text-amber" /> Meter Number (Optional)
              </Label>
              <Input
                placeholder="e.g. 14092841"
                value={meterNumber}
                onChange={(e) => setMeterNumber(e.target.value)}
                className="bg-surface border-line text-sm h-9 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <MapPin className="size-3.5 text-amber" /> Location / Area *
              </Label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full h-9 rounded-md border border-line bg-surface px-3 text-sm font-medium outline-none focus:border-amber"
              >
                {COMMON_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
                <option value="custom">Other / Custom Area</option>
              </select>
              {area === "custom" && (
                <Input
                  placeholder="Enter area name..."
                  value={customArea}
                  onChange={(e) => setCustomArea(e.target.value)}
                  className="bg-surface border-line text-xs h-8 mt-1.5"
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted">Meter Category</Label>
              <select
                value={meterType}
                onChange={(e) => setMeterType(e.target.value as any)}
                className="w-full h-9 rounded-md border border-line bg-surface px-3 text-sm font-medium outline-none focus:border-amber"
              >
                <option value="Residential">Residential</option>
                <option value="Commercial">Commercial</option>
                <option value="Mixed">Mixed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-line/60">
            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <DollarSign className="size-3.5 text-amber" /> Opening Balance (৳)
              </Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                required
                className="bg-surface border-line text-sm h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <Zap className="size-3.5 text-amber" /> Usual Daily Units (kWh)
              </Label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={usualDailyUnits}
                onChange={(e) => setUsualDailyUnits(e.target.value)}
                required
                className="bg-surface border-line text-sm h-9 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-line/60">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Tariff & Deduction Structure
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted">Rate (৳/kWh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.1"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="bg-surface border-line text-xs h-8 font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted">Meter Rent (৳)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={meterRent}
                  onChange={(e) => setMeterRent(e.target.value)}
                  className="bg-surface border-line text-xs h-8 font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted">Demand Chg (৳)</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  value={demandCharge}
                  onChange={(e) => setDemandCharge(e.target.value)}
                  className="bg-surface border-line text-xs h-8 font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted">VAT (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="bg-surface border-line text-xs h-8 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-line text-muted hover:text-ink text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber text-panel hover:bg-amber/90 font-medium text-xs h-9"
            >
              {isSubmitting ? "Creating..." : "Save Meter"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
