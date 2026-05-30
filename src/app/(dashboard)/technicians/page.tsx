import { getTechnicianList } from "@/lib/data/technicians";
import { TopBar } from "@/components/layout/TopBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Phone, Mail, Briefcase, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { AddTechnicianDialog } from "@/components/technicians/AddTechnicianDialog";

const TECH_STATUS_STYLE: Record<string, string> = {
  available:  "text-c-success bg-c-success border-c-success",
  on_job:     "text-c-info bg-c-info border-c-info",
  on_the_way: "text-c-teal bg-c-teal border-c-teal",
  off_duty:   "text-muted-foreground bg-muted/30 border-border",
};

const TECH_STATUS_LABEL: Record<string, string> = {
  available: "Available", on_job: "On Job", on_the_way: "En Route", off_duty: "Off Duty",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default async function TechniciansPage() {
  const technicians = await getTechnicianList();
  const active      = technicians.filter(t => t.isActive);
  const available   = active.filter(t => t.status === "available").length;

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Technicians" subtitle={`${technicians.length} total · ${available} available`} />

      <div className="flex-1 px-6 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5 text-sm">
            {[
              { label: "Available", count: available, cls: "text-c-success" },
              { label: "On Job",    count: active.filter(t => t.status === "on_job").length,     cls: "text-primary" },
              { label: "En Route",  count: active.filter(t => t.status === "on_the_way").length, cls: "text-c-teal" },
            ].map(({ label, count, cls }) => (
              <div key={label} className="flex items-center gap-2">
                <span className={cn("text-2xl font-semibold", cls)}>{count}</span>
                <span className="text-muted-foreground text-xs">{label}</span>
              </div>
            ))}
          </div>
          <AddTechnicianDialog />
        </div>

        {technicians.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No technicians found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {technicians.map(tech => (
              <Link key={tech.id} href={`/technicians/${tech.id}`} className="block group">
                <div className={cn(
                  "rounded-lg border bg-card p-5 space-y-4 transition-colors",
                  "hover:border-border/80 hover:bg-muted/20",
                  !tech.isActive && "opacity-60"
                )}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                          {initials(tech.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{tech.name}</p>
                        <p className="text-xs text-muted-foreground">{tech.specialty || "—"}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded border", TECH_STATUS_STYLE[tech.status] ?? TECH_STATUS_STYLE.off_duty)}>
                        {TECH_STATUS_LABEL[tech.status] ?? tech.status}
                      </span>
                      {!tech.isActive && (
                        <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {tech.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />{tech.phone}
                      </div>
                    )}
                    {tech.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
                        <Mail className="h-3 w-3 shrink-0" />{tech.email}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs border-t border-border pt-3">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Active:</span>
                      <span className="font-semibold text-foreground">{tech.activeJobs}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Done:</span>
                      <span className="font-semibold text-foreground">{tech.completedJobs}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
