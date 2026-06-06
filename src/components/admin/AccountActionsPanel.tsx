"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import {
  UserX, UserCheck, KeyRound, AlertTriangle, CheckCircle2, Eye, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

type Props = {
  profileId:       string | null;
  role:            "client" | "technician";
  isActive:        boolean;
  name:            string;
  activeJobCount?: number;
  activeJobItems?: { id: string; jobNumber: number | null }[];
};

type Modal = "none" | "deactivate" | "reactivate" | "reset_password";

// ── Component ──────────────────────────────────────────────────────────────────

export function AccountActionsPanel({
  profileId, role, isActive, name, activeJobCount = 0, activeJobItems = [],
}: Props) {
  const router = useRouter();

  const [modal,           setModal]           = useState<Modal>("none");
  const [loading,         setLoading]         = useState(false);
  const [actionError,     setActionError]     = useState<string | null>(null);
  const [actionSuccess,   setActionSuccess]   = useState<string | null>(null);
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass,        setShowPass]        = useState(false);

  // Track current isActive locally so UI updates without waiting for full page refresh
  const [localIsActive, setLocalIsActive] = useState(isActive);

  // No portal account linked — cannot manage
  if (!profileId) {
    return (
      <div className="rounded-lg border border-border bg-card p-5 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Account Management
        </h3>
        <p className="text-xs text-muted-foreground">
          No portal account linked to this {role}.
        </p>
      </div>
    );
  }

  async function callAction(action: string, extra: Record<string, unknown> = {}) {
    setLoading(true);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/accounts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, profileId, role, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(
          res.status === 500
            ? "Server configuration error. Ensure SUPABASE_SERVICE_ROLE_KEY is set."
            : (data.error ?? "Action failed. Please try again.")
        );
        setLoading(false);
        return false;
      }
      return true;
    } catch {
      setActionError("Network error. Please try again.");
      setLoading(false);
      return false;
    }
  }

  async function handleDeactivate() {
    const ok = await callAction("deactivate_account");
    if (ok) {
      setLocalIsActive(false);
      setActionSuccess(`${name} has been deactivated.`);
      setModal("none");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleReactivate() {
    const ok = await callAction("reactivate_account");
    if (ok) {
      setLocalIsActive(true);
      setActionSuccess(`${name} has been reactivated.`);
      setModal("none");
      router.refresh();
    }
    setLoading(false);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword) { setActionError("New password is required."); return; }
    if (newPassword.length < 8) { setActionError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setActionError("Passwords do not match."); return; }

    const ok = await callAction("reset_account_password", { newPassword });
    if (ok) {
      setActionSuccess(`Password reset. Give the new password to ${name} directly.`);
      setNewPassword("");
      setConfirmPassword("");
      setShowPass(false);
      setModal("none");
    }
    setLoading(false);
  }

  function openModal(m: Modal) {
    setActionError(null);
    setActionSuccess(null);
    setNewPassword("");
    setConfirmPassword("");
    setShowPass(false);
    setModal(m);
  }

  function closeModal() {
    if (loading) return;
    setModal("none");
    setActionError(null);
    setNewPassword("");
    setConfirmPassword("");
    setShowPass(false);
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Account Management
        </h3>

        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Portal access:</span>
            <span className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full border",
              localIsActive
                ? "text-c-success bg-c-success border-c-success"
                : "text-muted-foreground bg-muted/30 border-border"
            )}>
              {localIsActive ? "Active" : "Inactive"}
            </span>
          </div>
          {localIsActive ? (
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:border-destructive/60 hover:bg-destructive/5"
              onClick={() => openModal("deactivate")}
            >
              <UserX className="h-3.5 w-3.5" /> Deactivate
            </Button>
          ) : (
            <Button
              size="sm" variant="outline"
              className="h-7 text-xs gap-1.5 text-c-success border-c-success/30 hover:border-c-success/60"
              onClick={() => openModal("reactivate")}
            >
              <UserCheck className="h-3.5 w-3.5" /> Reactivate
            </Button>
          )}
        </div>

        {/* Reset Password */}
        <div className="border-t border-border pt-3">
          <Button
            size="sm" variant="outline"
            className="h-8 text-xs gap-1.5 w-full"
            onClick={() => openModal("reset_password")}
          >
            <KeyRound className="h-3.5 w-3.5" /> Reset Password
          </Button>
        </div>

        {/* Feedback messages */}
        {actionSuccess && (
          <p className="text-xs text-c-success flex items-start gap-1.5">
            <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />{actionSuccess}
          </p>
        )}
      </div>

      {/* ── Confirmation / action dialogs ───────────────────────────────────── */}
      <Dialog open={modal !== "none"} onOpenChange={o => { if (!o) closeModal(); }}>

        {/* Deactivate */}
        {modal === "deactivate" && (
          <DialogContent className="sm:max-w-sm" showCloseButton={!loading}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-destructive" /> Deactivate Account
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {role === "technician" && activeJobCount > 0 ? (
                <>
                  <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-destructive">
                        Cannot deactivate: {name} has {activeJobCount} active job{activeJobCount !== 1 ? "s" : ""}.
                      </p>
                      {activeJobItems.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Reassign or complete before deactivating:{" "}
                          {activeJobItems.map((j, i) => (
                            <span key={j.id}>
                              {i > 0 && ", "}
                              <span className="font-mono font-medium text-foreground">
                                {j.jobNumber ? `JOB-${String(j.jobNumber).padStart(4, "0")}` : "(no #)"}
                              </span>
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-9 text-xs"
                      onClick={closeModal}>
                      Close
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Deactivate <span className="font-medium text-foreground">{name}</span>?
                    They will no longer be able to log in to the portal.
                  </p>
                  {actionError && (
                    <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                      {actionError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-9 text-xs"
                      onClick={closeModal} disabled={loading}>
                      Cancel
                    </Button>
                    <Button size="sm"
                      className="flex-1 h-9 text-xs bg-destructive hover:bg-destructive/90 text-white"
                      onClick={handleDeactivate} disabled={loading}>
                      {loading ? "Deactivating…" : "Deactivate"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        )}

        {/* Reactivate */}
        {modal === "reactivate" && (
          <DialogContent className="sm:max-w-sm" showCloseButton={!loading}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-c-success" /> Reactivate Account
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reactivate <span className="font-medium text-foreground">{name}</span>?
                They will be able to log in again.
              </p>
              {actionError && (
                <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                  {actionError}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 h-9 text-xs"
                  onClick={closeModal} disabled={loading}>
                  Cancel
                </Button>
                <Button size="sm" className="flex-1 h-9 text-xs"
                  onClick={handleReactivate} disabled={loading}>
                  {loading ? "Reactivating…" : "Reactivate"}
                </Button>
              </div>
            </div>
          </DialogContent>
        )}

        {/* Reset Password */}
        {modal === "reset_password" && (
          <DialogContent className="sm:max-w-sm" showCloseButton={!loading}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" /> Reset Password
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <p className="text-xs text-muted-foreground">
                Set a new password for{" "}
                <span className="font-medium text-foreground">{name}</span>.
                Give it to them directly — no email will be sent.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="rp-new" className="text-xs">
                  New password <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="rp-new"
                    type={showPass ? "text" : "password"}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setActionError(null); }}
                    placeholder="Min. 8 characters"
                    className="h-9 text-sm pr-9"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-confirm" className="text-xs">
                  Confirm new password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="rp-confirm"
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setActionError(null); }}
                  placeholder="Re-enter password"
                  className="h-9 text-sm"
                  autoComplete="new-password"
                />
              </div>
              {actionError && (
                <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                  {actionError}
                </p>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="flex-1 h-9 text-xs"
                  onClick={closeModal} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="flex-1 h-9 text-xs" disabled={loading}>
                  {loading ? "Resetting…" : "Reset Password"}
                </Button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
