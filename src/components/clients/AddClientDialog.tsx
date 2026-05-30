"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { Plus, CheckCircle2, Eye, EyeOff, Building2 } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type FormState = {
  companyName:     string;
  contactName:     string;
  email:           string;
  phone:           string;
  address:         string;
  notes:           string;
  password:        string;
  confirmPassword: string;
};

const EMPTY: FormState = {
  companyName: "", contactName: "", email: "",
  phone: "", address: "", notes: "",
  password: "", confirmPassword: "",
};

// ── Validation ─────────────────────────────────────────────────────────────────

function validate(f: FormState): string | null {
  if (!f.companyName.trim())  return "Company name is required.";
  if (!f.contactName.trim())  return "Contact person name is required.";
  if (!f.email.trim())        return "Email address is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
                              return "Enter a valid email address.";
  if (!f.password)            return "Password is required.";
  if (f.password.length < 8)  return "Password must be at least 8 characters.";
  if (f.password !== f.confirmPassword)
                              return "Passwords do not match.";
  return null;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function AddClientDialog() {
  const router = useRouter();

  const [open,        setOpen]        = useState(false);
  const [form,        setForm]        = useState<FormState>(EMPTY);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showPass,    setShowPass]    = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ companyName: string; email: string } | null>(null);

  function field(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
      setError(null);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(form);
    if (err) { setError(err); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/accounts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:      "create_client_account",
          email:       form.email.trim().toLowerCase(),
          password:    form.password,
          companyName: form.companyName.trim(),
          contactName: form.contactName.trim(),
          phone:       form.phone.trim()   || undefined,
          address:     form.address.trim() || undefined,
          notes:       form.notes.trim()   || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError("A user with this email already exists. Use a different email.");
        } else if (res.status === 500) {
          setError(
            "Server configuration error. Ensure SUPABASE_SERVICE_ROLE_KEY is set and restart the server."
          );
        } else {
          setError(data.error ?? "Failed to create client. Please try again.");
        }
        setLoading(false);
        return;
      }

      setSuccessInfo({ companyName: form.companyName.trim(), email: form.email.trim() });
      router.refresh(); // reload server component to show new client in the list
    } catch {
      setError("Network error. Check your connection and try again.");
    }
    setLoading(false);
  }

  function handleClose(nextOpen: boolean) {
    if (loading) return;
    if (!nextOpen) {
      // Reset on close only when not in the middle of a request
      setForm(EMPTY);
      setError(null);
      setSuccessInfo(null);
      setShowPass(false);
    }
    setOpen(nextOpen);
  }

  function addAnother() {
    setForm(EMPTY);
    setError(null);
    setSuccessInfo(null);
    setShowPass(false);
  }

  return (
    <>
      <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Client
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh]" showCloseButton={!loading}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Add Client
            </DialogTitle>
          </DialogHeader>

          {/* ── Success state ─────────────────────────────────────────────── */}
          {successInfo ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-c-success/15 border border-c-success/30">
                <CheckCircle2 className="h-7 w-7 text-c-success" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {successInfo.companyName} created
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {successInfo.email} can now log in to the client portal.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleClose(false)}>
                  Close
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={addAnother}>
                  Add another
                </Button>
              </div>
            </div>
          ) : (
          /* ── Form state ───────────────────────────────────────────────── */
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>

              {/* Company section */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Company
                </legend>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-companyName" className="text-xs">
                    Company name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ac-companyName"
                    value={form.companyName}
                    onChange={field("companyName")}
                    placeholder="Acme Security Ltd"
                    className="h-9 text-sm"
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-address" className="text-xs">Address</Label>
                  <Input
                    id="ac-address"
                    value={form.address}
                    onChange={field("address")}
                    placeholder="123 Main St, City, State"
                    className="h-9 text-sm"
                  />
                </div>
              </fieldset>

              {/* Contact section */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Primary Contact
                </legend>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-contactName" className="text-xs">
                    Contact name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ac-contactName"
                    value={form.contactName}
                    onChange={field("contactName")}
                    placeholder="Jane Smith"
                    className="h-9 text-sm"
                    autoComplete="name"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ac-email" className="text-xs">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="ac-email"
                      type="email"
                      value={form.email}
                      onChange={field("email")}
                      placeholder="jane@acme.com"
                      className="h-9 text-sm"
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ac-phone" className="text-xs">Phone</Label>
                    <Input
                      id="ac-phone"
                      type="tel"
                      value={form.phone}
                      onChange={field("phone")}
                      placeholder="555-0100"
                      className="h-9 text-sm"
                      autoComplete="tel"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Credentials section */}
              <fieldset className="space-y-3">
                <legend className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Portal Credentials
                </legend>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-password" className="text-xs">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="ac-password"
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={field("password")}
                      placeholder="Min. 8 characters"
                      className="h-9 text-sm pr-9"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(p => !p)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass
                        ? <EyeOff className="h-3.5 w-3.5" />
                        : <Eye    className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ac-confirmPassword" className="text-xs">
                    Confirm password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ac-confirmPassword"
                    type={showPass ? "text" : "password"}
                    value={form.confirmPassword}
                    onChange={field("confirmPassword")}
                    placeholder="Re-enter password"
                    className="h-9 text-sm"
                    autoComplete="new-password"
                  />
                </div>
              </fieldset>

              {/* Error message */}
              {error && (
                <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2 leading-relaxed">
                  {error}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
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
                  {loading ? "Creating…" : "Create Client"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
