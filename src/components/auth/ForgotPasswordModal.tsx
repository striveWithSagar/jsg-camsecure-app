"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { CheckCircle2, KeyRound } from "lucide-react";

type Props = {
  role: "client" | "technician";
};

// Generic success message — identical for known/unknown emails (anti-enumeration)
const SUCCESS_MSG =
  "If this account exists, an admin has been notified to help reset the password.";

export function ForgotPasswordModal({ role }: Props) {
  const [open,    setOpen]    = useState(false);
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  function handleOpen() {
    setOpen(true);
    setEmail("");
    setDone(false);
    setError(null);
  }

  function handleClose(next: boolean) {
    if (loading) return;
    setOpen(next);
    if (!next) {
      setEmail("");
      setDone(false);
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email address is required."); return; }

    setLoading(true);
    setError(null);

    try {
      await fetch("/api/auth/request-password-help", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim(), role }),
      });
      // Always show success — anti-enumeration
      setDone(true);
    } catch {
      // Network errors still show success — avoid leaking system state
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
      >
        Forgot password?
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-sm" showCloseButton={!loading}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Forgot password
            </DialogTitle>
          </DialogHeader>

          {done ? (
            /* ── Success state (always shown, known or unknown email) ── */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-c-success/15 border border-c-success/30">
                <CheckCircle2 className="h-6 w-6 text-c-success" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                {SUCCESS_MSG}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => handleClose(false)}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            /* ── Request form ── */
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Enter your email address and we will notify an admin to reset
                your password for you.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fp-email" className="text-xs">
                  Email address
                </Label>
                <Input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); }}
                  placeholder={role === "client" ? "you@company.com" : "tech@camsecure.com"}
                  className="h-9 text-sm"
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="text-xs text-destructive">{error}</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  onClick={() => handleClose(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="flex-1 h-9 text-xs"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Request help"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
