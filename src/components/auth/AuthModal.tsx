import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogIn, UserPlus, Sparkles, KeyRound, Mail, User } from "lucide-react";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
}

export function AuthModal({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) {
  const { login, register, signInWithGoogle, loginAsDemo } = useAuth();
  const [tab, setTab] = useState<"login" | "register">(defaultTab);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setError(null);
  };

  const handleSwitchTab = (newTab: "login" | "register") => {
    setTab(newTab);
    setError(null);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      if (err?.code !== "auth/popup-closed-by-user") {
        setError(err.message || "Failed to sign in with Google.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoFill = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await loginAsDemo();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Failed to log in with demo account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (tab === "login") {
        await login({ email, password });
      } else {
        if (!name.trim()) {
          setError("Name is required.");
          setIsSubmitting(false);
          return;
        }
        await register({ name, email, password });
      }
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] border-line bg-panel text-ink p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="grid size-8 place-items-center rounded-[8px] bg-amber text-panel">
              <span className="font-display font-semibold text-sm">M</span>
            </div>
            <DialogTitle className="font-display text-lg font-semibold">
              {tab === "login" ? "Sign In to Meter Trace" : "Create an Account"}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted">
            {tab === "login"
              ? "Access your live prepaid electricity meters, Firestore sync, and predictions."
              : "Track your real prepaid electricity meters with automated recharge predictions."}
          </DialogDescription>
        </DialogHeader>

        {/* Google One-Click Sign In */}
        <div className="my-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full h-10 border-line hover:border-amber/60 bg-surface hover:bg-panel text-ink text-xs font-medium flex items-center justify-center gap-2.5 transition-all shadow-sm"
          >
            <svg className="size-4" viewBox="0 0 24 24">
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
            Continue with Google
          </Button>
        </div>

        <div className="relative my-2.5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-panel px-2 text-muted text-[10px]">Or with email</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-lg border border-line p-1 bg-surface mb-2">
          <button
            type="button"
            onClick={() => handleSwitchTab("login")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              tab === "login"
                ? "bg-panel text-ink shadow-sm border border-line/40"
                : "text-muted hover:text-ink"
            }`}
          >
            <LogIn className="size-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleSwitchTab("register")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
              tab === "register"
                ? "bg-panel text-ink shadow-sm border border-line/40"
                : "text-muted hover:text-ink"
            }`}
          >
            <UserPlus className="size-3.5" />
            Register
          </button>
        </div>

        {error && (
          <div className="p-2.5 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          {tab === "register" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted flex items-center gap-1.5">
                <User className="size-3.5 text-amber" /> Full Name
              </Label>
              <Input
                placeholder="e.g. Ainal Haque"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-surface border-line focus:border-amber text-sm h-9"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs text-muted flex items-center gap-1.5">
              <Mail className="size-3.5 text-amber" /> Email Address
            </Label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-surface border-line focus:border-amber text-sm h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-amber" /> Password
            </Label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="bg-surface border-line focus:border-amber text-sm h-9"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-amber text-panel hover:bg-amber/90 font-medium text-sm h-9 mt-2"
          >
            {isSubmitting
              ? "Processing..."
              : tab === "login"
                ? "Sign In with Email"
                : "Create Account"}
          </Button>
        </form>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-line" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-panel px-2 text-muted text-[10px]">Testing / Demo</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleDemoFill}
          disabled={isSubmitting}
          className="w-full border-amber/40 bg-amber/5 hover:bg-amber/10 text-ink text-xs h-8 flex items-center justify-center gap-2"
        >
          <Sparkles className="size-3.5 text-amber" />
          1-Click Instant Demo Login
        </Button>
      </DialogContent>
    </Dialog>
  );
}
