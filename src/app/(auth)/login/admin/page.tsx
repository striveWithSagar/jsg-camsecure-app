"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email    = formData.get("email")    as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", authData.user.id)
      .single();

    if (!["admin", "owner", "dispatcher"].includes(profile?.role ?? "")) {
      await supabase.auth.signOut();
      setError("This account does not have admin portal access.");
      setLoading(false);
      return;
    }

    if (!profile?.is_active) {
      await supabase.auth.signOut();
      setError("This admin account has been deactivated. Please contact the account owner.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* Left — brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-sidebar border-r border-sidebar-border px-10 py-12">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">CamSecure</p>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Field Operations</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-3xl font-semibold text-foreground leading-tight mb-3">
              Operations at your fingertips
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Dispatch technicians, track jobs, manage clients, and close invoices — all from one command center.
            </p>
          </div>
          <div className="space-y-3">
            {[
              "Live job board with priority dispatch",
              "Technician status tracking in real-time",
              "Automated client email notifications",
              "Stripe-powered invoice & payment links",
            ].map(item => (
              <div key={item} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">© 2026 JSG CamSecure. All rights reserved.</p>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-7">

          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to role selection
          </Link>

          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
              <ShieldCheck className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">CamSecure</p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-foreground">Admin sign in</h2>
            <p className="text-sm text-muted-foreground mt-1">Access the operations dashboard</p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@jsg.com"
                className="h-10 text-sm"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <span className="text-xs text-muted-foreground">Forgot password? <span className="opacity-60">(Coming soon)</span></span>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="h-10 text-sm"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-10 text-sm font-medium"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in to Dashboard"}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
