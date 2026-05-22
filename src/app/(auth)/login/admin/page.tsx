import { ShieldCheck, ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin Login · CamSecure" };

export default function AdminLoginPage() {
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

          {/* Back link */}
          <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3 w-3" /> Back to role selection
          </Link>

          {/* Mobile logo */}
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

          <form className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email address</Label>
              <Input id="email" type="email" placeholder="admin@jsg.com" className="h-10 text-sm" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
              </div>
              <Input id="password" type="password" placeholder="••••••••" className="h-10 text-sm" autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full h-10 text-sm font-medium">Sign in to Dashboard</Button>
          </form>

          <div className="border-t border-border pt-5">
            <p className="text-xs text-muted-foreground mb-3">Quick access (demo):</p>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between h-auto py-3 px-4")}
            >
              <div className="text-left">
                <p className="text-xs font-medium text-foreground">JSG Admin</p>
                <p className="text-xs text-muted-foreground">admin@jsg.com</p>
              </div>
              <span className="text-xs text-primary">Enter →</span>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
