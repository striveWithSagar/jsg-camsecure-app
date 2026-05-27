"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Bell, Lock, CreditCard } from "lucide-react";
import type { OrgSettings } from "@/lib/data/settings";

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

const NOTIFICATIONS = [
  "Email notify client when technician is assigned",
  "Email notify client when job is completed",
  "In-app notify admin on new service request",
  "In-app notify admin when job is overdue",
  "In-app notify technician on new job assignment",
];

type Props = {
  settings:   OrgSettings;
  userId:     string;
  adminName:  string;
  adminEmail: string;
};

export function SettingsClient({ settings, userId, adminName: initialAdminName, adminEmail }: Props) {
  const [orgName, setOrgName]         = useState(settings.businessName);
  const [phone, setPhone]             = useState(settings.phone);
  const [address, setAddress]         = useState(settings.address);
  const [emailFooter, setEmailFooter] = useState(settings.invoiceFooterNote);
  const [orgLoading, setOrgLoading]   = useState(false);

  const [adminName, setAdminName]           = useState(initialAdminName);
  const [password, setPassword]             = useState("");
  const [accountLoading, setAccountLoading] = useState(false);

  const [notifs, setNotifs] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATIONS.map(n => [n, true]))
  );

  async function saveOrg() {
    setOrgLoading(true);
    const supabase = createClient();

    const [csResult, orgResult] = await Promise.all([
      supabase
        .from("company_settings")
        .update({ business_name: orgName, invoice_footer_note: emailFooter })
        .eq("id", settings.companySettingsId),
      supabase
        .from("organizations")
        .update({ phone, address })
        .eq("id", settings.orgId),
    ]);

    if (csResult.error || orgResult.error) {
      toast.error(csResult.error?.message ?? orgResult.error?.message ?? "Save failed");
    } else {
      toast.success("Organization saved");
    }
    setOrgLoading(false);
  }

  async function saveAccount() {
    setAccountLoading(true);
    const supabase = createClient();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: adminName })
      .eq("id", userId);

    if (profileError) {
      toast.error(profileError.message);
      setAccountLoading(false);
      return;
    }

    if (password.trim()) {
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) {
        toast.error(pwError.message);
        setAccountLoading(false);
        return;
      }
      setPassword("");
    }

    toast.success("Account updated");
    setAccountLoading(false);
  }

  function saveNotifs() {
    toast.info("Notification delivery is not configured yet — preferences were not saved.");
  }

  function saveInteg(name: string) {
    toast.info(`${name} integration coming soon`);
  }

  return (
    <div className="flex-1 px-6 py-6 max-w-2xl space-y-5">

      {/* Organization */}
      <SettingSection icon={Building2} title="Organization">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-xs">Company Name</Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-phone" className="text-xs">Phone Number</Label>
            <Input
              id="org-phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-address" className="text-xs">Business Address</Label>
            <Input
              id="org-address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="email-footer" className="text-xs">Email Signature / Footer (for client emails)</Label>
            <Textarea
              id="email-footer"
              rows={2}
              className="text-sm resize-none"
              value={emailFooter}
              onChange={e => setEmailFooter(e.target.value)}
            />
          </div>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={saveOrg} disabled={orgLoading}>
          {orgLoading ? "Saving…" : "Save Organization"}
        </Button>
      </SettingSection>

      {/* Notifications */}
      <SettingSection icon={Bell} title="Notifications">
        <div className="space-y-3">
          {NOTIFICATIONS.map(label => (
            <label key={label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifs[label]}
                onChange={e => setNotifs(prev => ({ ...prev, [label]: e.target.checked }))}
                className="h-4 w-4 rounded border-border bg-muted accent-primary cursor-pointer"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={saveNotifs}>
          Save Preferences
        </Button>
      </SettingSection>

      {/* Account */}
      <SettingSection icon={Lock} title="Account & Security">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-name" className="text-xs">Admin Name</Label>
            <Input
              id="admin-name"
              value={adminName}
              onChange={e => setAdminName(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email" className="text-xs">Admin Email</Label>
            <Input
              id="admin-email"
              type="email"
              value={adminEmail}
              readOnly
              className="h-9 text-sm bg-muted/50 cursor-default"
            />
            <p className="text-[11px] text-muted-foreground">Contact support to change your login email.</p>
          </div>
        </div>
        <Separator className="bg-border" />
        <div className="space-y-1.5">
          <Label htmlFor="new-password" className="text-xs">New Password</Label>
          <Input
            id="new-password"
            type="password"
            placeholder="Leave blank to keep current"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={saveAccount} disabled={accountLoading}>
          {accountLoading ? "Saving…" : "Update Account"}
        </Button>
      </SettingSection>

      {/* Integrations */}
      <SettingSection icon={CreditCard} title="Integrations">
        <div className="space-y-3">
          {[
            { name: "Stripe (Payments)",  status: "Not connected", connected: false, active: false },
            { name: "Resend (Email)",      status: "Not connected", connected: false, active: false },
            { name: "Supabase (Database)", status: "Connected",     connected: true,  active: true  },
          ].map(({ name, status, connected, active }) => (
            <div key={name} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{name}</p>
                <p className={`text-xs ${connected ? "text-[oklch(0.72_0.135_155)]" : "text-muted-foreground"}`}>
                  {status}
                </p>
              </div>
              {active ? (
                <span className="text-xs text-[oklch(0.72_0.135_155)] font-medium px-2">Active</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => saveInteg(name)}
                >
                  Connect
                </Button>
              )}
            </div>
          ))}
        </div>
      </SettingSection>

    </div>
  );
}
