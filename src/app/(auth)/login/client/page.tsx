"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ForgotPasswordModal } from "@/components/auth/ForgotPasswordModal";

export default function ClientLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form     = e.currentTarget;
    const email    = (form.elements.namedItem("email")    as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", data.user.id)
      .single();

    if (!profile || profile.role !== "client") {
      await supabase.auth.signOut();
      setError("This account does not have client access.");
      setLoading(false);
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      setError("This account is inactive. Please contact admin.");
      setLoading(false);
      return;
    }

    router.push("/client");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-7">

        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to role selection
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">CamSecure</p>
            <p className="text-xs text-muted-foreground">Field Operations</p>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 className="h-4 w-4 text-c-violet" />
            <h2 className="text-2xl font-semibold text-foreground">Client portal</h2>
          </div>
          <p className="text-sm text-muted-foreground">Track your security systems, invoices, and service requests.</p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              className="h-11 text-sm"
              autoComplete="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="h-11 text-sm"
              autoComplete="current-password"
              required
            />
          </div>
          <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
            {loading ? "Signing in…" : "Sign in to Portal"}
          </Button>
        </form>

        <div className="flex items-center justify-between text-xs">
          <ForgotPasswordModal role="client" />
          <p className="text-muted-foreground">
            Not a client?{" "}
            <Link href="/" className="text-primary hover:underline">Change role</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
