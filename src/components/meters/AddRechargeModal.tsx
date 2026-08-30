import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { firebaseService } from "@/lib/firebase-service";
import type { MeterCase } from "@/lib/api";
import { bdt, creditFromRecharge } from "@/lib/meter";
import { toast } from "sonner";
import { Zap, CreditCard, Calendar, FileText, ArrowRight, Upload, Paperclip } from "lucide-react";

interface AddRechargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meter: MeterCase;
  onRechargeComplete: () => void;
}

const PRESET_AMOUNTS = [500, 1000, 1500, 2000, 3000, 5000];

export function AddRechargeModal({
  open,
  onOpenChange,
  meter,
  onRechargeComplete,
}: AddRechargeModalProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState("1000");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const breakdown = creditFromRecharge(numAmount, meter.tariff);
  const currentBal = meter.history?.[meter.history.length - 1]?.balance ?? meter.openingBalance;
  const estimatedNewBalance = Math.round((currentBal + breakdown.credit) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount < 50) {
      setError("Minimum recharge amount is 50 BDT");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      let receiptUrl: string | undefined;
      if (receiptFile && user) {
        try {
          receiptUrl = await firebaseService.uploadAttachment(receiptFile, `receipts/${user.uid}`);
        } catch (uploadErr) {
          console.warn("Storage upload skipped or failed:", uploadErr);
        }
      }

      await firebaseService.recordRecharge(
        meter.id,
        {
          amount: numAmount,
          date,
          notes: notes.trim() || undefined,
          receiptUrl,
        },
        user?.uid
      );

      toast.success(`Recharge of ৳${numAmount} logged to Firestore! Net credit: ৳${breakdown.credit.toFixed(2)}`);
      onRechargeComplete();
      onOpenChange(false);
      setAmount("1000");
      setNotes("");
      setReceiptFile(null);
    } catch (err: any) {
      setError(err.message || "Failed to record recharge.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] border-line bg-panel text-ink p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-[8px] bg-amber text-panel">
              <Zap className="size-4" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold">
                Quick Recharge
              </DialogTitle>
              <DialogDescription className="text-xs text-muted">
                {meter.label} · Current Balance: <span className="font-mono text-ink font-semibold">{bdt(currentBal)}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {error && (
          <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Quick preset buttons */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted">Quick Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className={`py-1.5 px-2 rounded-md border text-xs font-mono font-medium transition-colors ${
                    numAmount === amt
                      ? "border-amber bg-amber/10 text-amber font-semibold"
                      : "border-line bg-surface text-muted hover:text-ink hover:border-line/80"
                  }`}
                >
                  ৳ {amt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <CreditCard className="size-3.5 text-amber" /> Amount (৳) *
              </Label>
              <Input
                type="number"
                step="50"
                min="50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="bg-surface border-line text-sm h-9 font-mono font-semibold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <Calendar className="size-3.5 text-amber" /> Date
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="bg-surface border-line text-xs h-9 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <FileText className="size-3.5 text-amber" /> Note / Ref
              </Label>
              <Input
                placeholder="e.g. Bkash Trx ID 9KJ..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-surface border-line text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1">
                <Paperclip className="size-3.5 text-amber" /> Receipt Photo (Storage)
              </Label>
              <Input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="bg-surface border-line text-xs h-9 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-amber/10 file:text-amber hover:file:bg-amber/20 cursor-pointer"
              />
            </div>
          </div>

          {/* Breakdown calculation card */}
          <div className="rounded-lg border border-line bg-surface p-3 space-y-2 text-xs">
            <div className="flex justify-between text-muted">
              <span>Gross Recharge:</span>
              <span className="font-mono text-ink">৳ {numAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Fixed Fees (Rent + Demand):</span>
              <span className="font-mono text-rose-400">-৳ {breakdown.fees.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>VAT ({((meter.tariff?.vatRate ?? 0.05) * 100).toFixed(0)}%):</span>
              <span className="font-mono text-rose-400">-৳ {breakdown.vat.toFixed(2)}</span>
            </div>
            <div className="border-t border-line/60 pt-2 flex justify-between font-medium">
              <span className="text-amber">Net Credit Added:</span>
              <span className="font-mono text-amber font-semibold text-sm">
                +৳ {breakdown.credit.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-line/40 text-[11px] text-muted">
              <span>New Balance:</span>
              <div className="flex items-center gap-1 font-mono">
                <span>{bdt(currentBal)}</span>
                <ArrowRight className="size-3" />
                <span className="text-emerald-400 font-semibold">{bdt(estimatedNewBalance)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
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
              disabled={isSubmitting || numAmount <= 0}
              className="bg-amber text-panel hover:bg-amber/90 font-medium text-xs h-9"
            >
              {isSubmitting ? "Processing..." : "Confirm Recharge"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
