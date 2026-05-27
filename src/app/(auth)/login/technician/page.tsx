"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, HardHat, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default function TechnicianLoginPage() {
  const router = useRouter();
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email    = formData.get("email")    as string;
    const password = formData.get("password") as string;

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Verify technician role before navigating
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "technician") {
        await supabase.auth.signOut();
        setError("This account does not have technician access.");
        setLoading(false);
        return;
      }
    }

    router.push("/technician");
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
            <HardHat className="h-4 w-4 text-c-teal" />
            <h2 className="text-2xl font-semibold text-foreground">Technician sign in</h2>
          </div>
          <p className="text-sm text-muted-foreground">View your assigned jobs and update status on the go.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="tech@camsecure.com"
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

          {error && (
            <p className="text-xs text-destructive bg-destructive/8 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Not a technician?{" "}
          <Link href="/" className="text-primary hover:underline">Change role</Link>
        </p>

      </div>
    </div>
  );
}
