import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Bell, Lock, Users, CreditCard } from "lucide-react";

function SettingSection({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-5 py-5 space-y-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" subtitle="Organization & account configuration" />

      <div className="flex-1 px-6 py-6 max-w-2xl space-y-5">

        {/* Organization */}
        <SettingSection icon={Building2} title="Organization">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Company Name</Label>
              <Input defaultValue="JSG CamSecure" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone Number</Label>
              <Input defaultValue="555-9000" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Business Address</Label>
              <Input defaultValue="100 Security Blvd, Suite 200" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Email Signature / Footer (for client emails)</Label>
              <Textarea rows={2} className="text-sm resize-none" defaultValue="JSG CamSecure — Professional Security Installation" />
            </div>
          </div>
          <Button size="sm" className="h-8 text-xs">Save Organization</Button>
        </SettingSection>

        {/* Notifications */}
        <SettingSection icon={Bell} title="Notifications">
          <div className="space-y-3">
            {[
              { label: "Email notify client when technician is assigned", checked: true },
              { label: "Email notify client when job is completed", checked: true },
              { label: "In-app notify admin on new service request", checked: true },
              { label: "In-app notify admin when job is overdue", checked: true },
              { label: "In-app notify technician on new job assignment", checked: true },
            ].map(({ label, checked }) => (
              <label key={label} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked={checked}
                  className="h-4 w-4 rounded border-border bg-muted accent-primary cursor-pointer"
                />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs">Save Preferences</Button>
        </SettingSection>

        {/* Account */}
        <SettingSection icon={Lock} title="Account & Security">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Admin Name</Label>
              <Input defaultValue="JSG Admin" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Admin Email</Label>
              <Input defaultValue="admin@jsg.com" type="email" className="h-9 text-sm" />
            </div>
          </div>
          <Separator className="bg-border" />
          <div className="space-y-1.5">
            <Label className="text-xs">New Password</Label>
            <Input type="password" placeholder="Leave blank to keep current" className="h-9 text-sm" />
          </div>
          <Button size="sm" variant="outline" className="h-8 text-xs">Update Account</Button>
        </SettingSection>

        {/* Integrations */}
        <SettingSection icon={CreditCard} title="Integrations">
          <div className="space-y-3">
            {[
              { name: "Stripe (Payments)",   status: "Not connected", connected: false },
              { name: "Resend (Email)",       status: "Not connected", connected: false },
              { name: "Supabase (Database)",  status: "Connected",     connected: true  },
            ].map(({ name, status, connected }) => (
              <div key={name} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{name}</p>
                  <p className={`text-xs ${connected ? "text-[oklch(0.72_0.135_155)]" : "text-muted-foreground"}`}>{status}</p>
                </div>
                <Button size="sm" variant={connected ? "outline" : "default"} className="h-7 text-xs">
                  {connected ? "Configure" : "Connect"}
                </Button>
              </div>
            ))}
          </div>
        </SettingSection>

      </div>
    </div>
  );
}
