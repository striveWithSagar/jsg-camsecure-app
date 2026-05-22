import { ShieldCheck, Building2, ArrowLeft } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { cn } from "@/lib/utils";

export const metadata = { title: "Client Portal Login · CamSecure" };

export default function ClientLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm space-y-7">

        {/* Back link */}
        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to role selection
        </Link>

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 border border-primary/25">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">CamSecure</p>
            <p className="text-xs text-muted-foreground">Field Operations</p>
          </div>
        </div>

        {/* Heading */}
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Building2 className="h-4 w-4 text-c-violet" />
            <h2 className="text-2xl font-semibold text-foreground">Client portal</h2>
          </div>
          <p className="text-sm text-muted-foreground">Track your security systems, invoices, and service requests.</p>
        </div>

        <form className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">Email address</Label>
            <Input id="email" type="email" placeholder="you@company.com" className="h-11 text-sm" autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" className="h-11 text-sm" autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full h-11 text-sm font-medium">Sign in to Portal</Button>
        </form>

        <div className="border-t border-border pt-5">
          <p className="text-xs text-muted-foreground mb-3">Quick access (demo):</p>
          <Link
            href="/client"
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-between h-auto py-3 px-4")}
          >
            <div className="text-left">
              <p className="text-xs font-medium text-foreground">Metro Security Ltd</p>
              <p className="text-xs text-muted-foreground">d.park@metro.com</p>
            </div>
            <span className="text-xs text-c-violet">Enter →</span>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Not a client?{" "}
          <Link href="/" className="text-primary hover:underline">Change role</Link>
        </p>

      </div>
    </div>
  );
}
