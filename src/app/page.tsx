import Link from "next/link";
import { ShieldCheck, HardHat, Building2, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "CamSecure Operations — Welcome",
};

const ROLES = [
  {
    icon: ShieldCheck,
    title: "Admin / Dispatcher",
    description: "Full operations command. Dispatch technicians, manage jobs, handle clients and invoicing.",
    access: [
      "Live job board & priority dispatch",
      "Technician status & field tracking",
      "Client management & invoices",
    ],
    href: "/login/admin",
    iconClass: "bg-primary/12 border-primary/20 text-primary",
    cardHover: "hover:border-primary/50",
    cta: "Sign in as Admin",
    ctaClass: cn(buttonVariants(), "w-full justify-between gap-2 h-10"),
  },
  {
    icon: HardHat,
    title: "Technician",
    description: "Your daily field briefing. Assigned jobs, site details, and real-time status updates.",
    access: [
      "Today's assigned jobs",
      "Site address & job detail",
      "Mark progress & completion",
    ],
    href: "/login/technician",
    iconClass: "bg-c-teal border-c-teal text-c-teal",
    cardHover: "hover:border-c-teal",
    cta: "Sign in as Technician",
    ctaClass: "w-full flex items-center justify-between gap-2 h-10 px-4 rounded-md border border-c-teal text-c-teal text-sm font-medium hover:bg-c-teal hover:text-foreground transition-colors",
  },
  {
    icon: Building2,
    title: "Client Portal",
    description: "Track your installations and maintenance. View live job status, invoices, and raise requests.",
    access: [
      "Live job status tracking",
      "Invoice & payment history",
      "Submit service requests",
    ],
    href: "/login/client",
    iconClass: "bg-c-violet border-c-violet text-c-violet",
    cardHover: "hover:border-c-violet",
    cta: "Access Client Portal",
    ctaClass: "w-full flex items-center justify-between gap-2 h-10 px-4 rounded-md border border-c-violet text-c-violet text-sm font-medium hover:bg-c-violet hover:text-foreground transition-colors",
  },
] as const;

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{
          background: "radial-gradient(ellipse 70% 40% at 50% 0%, oklch(0.60 0.210 252 / 0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-16">

        {/* Brand mark */}
        <div className="flex flex-col items-center gap-4 mb-12">
          <div className="relative">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/12 border border-primary/25">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div className="absolute -inset-2 rounded-3xl border border-primary/8 pointer-events-none" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">CamSecure Operations</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Field service operations for security and camera installation teams
            </p>
          </div>
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-6">
          Who are you signing in as?
        </p>

        {/* Role cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
          {ROLES.map(({ icon: Icon, title, description, access, href, iconClass, cardHover, cta, ctaClass }) => (
            <div
              key={title}
              className={cn(
                "flex flex-col rounded-xl border border-border bg-card p-6 transition-colors",
                cardHover
              )}
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg border mb-4", iconClass)}>
                <Icon className="h-5 w-5" />
              </div>

              <h2 className="text-sm font-semibold text-foreground mb-1.5">{title}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed mb-5">{description}</p>

              <ul className="space-y-2 mb-6 flex-1">
                {access.map(item => (
                  <li key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 mt-0.5 text-muted-foreground/50 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link href={href} className={ctaClass}>
                {cta}
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </div>
          ))}
        </div>

      </div>

      <footer className="relative text-center py-5 border-t border-border">
        <p className="text-[10px] text-muted-foreground">© 2026 JSG CamSecure. All rights reserved.</p>
      </footer>
    </div>
  );
}
