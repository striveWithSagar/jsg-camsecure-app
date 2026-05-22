"use client";

import { useState } from "react";
import { ArrowLeft, Camera, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { SERVICE_TYPES, URGENCY_LEVELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Errors = Partial<Record<string, string>>;

export default function ClientNewRequestPage() {
  const [submitted, setSubmitted]     = useState(false);
  const [serviceType, setServiceType] = useState("");
  const [urgency, setUrgency]         = useState("");
  const [errors, setErrors]           = useState<Errors>({});

  function clearError(key: string) {
    setErrors(prev => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data   = new FormData(e.currentTarget);
    const name   = (data.get("name")        as string).trim();
    const phone  = (data.get("phone")       as string).trim();
    const email  = (data.get("email")       as string).trim();
    const address = (data.get("address")    as string).trim();
    const desc   = (data.get("description") as string).trim();

    const next: Errors = {};
    if (!name)                    next.name        = "Contact name is required.";
    if (!phone && !email)         next.phone       = "Provide a phone number or email.";
    if (!address)                 next.address     = "Site address is required.";
    if (!serviceType)             next.serviceType = "Please select a service type.";
    if (!urgency)                 next.urgency     = "Please select an urgency level.";
    if (!desc)                    next.description = "Please describe the issue.";

    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-c-success border border-c-success">
          <CheckCircle2 className="h-8 w-8 text-c-success" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Request submitted</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Our team has received your request and will be in touch within 1 business day to confirm scheduling.
          </p>
        </div>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => {
            setSubmitted(false);
            setServiceType("");
            setUrgency("");
            setErrors({});
          }}>
            Submit another
          </Button>
          <Link href="/client">
            <Button size="sm" className="h-9">Back to overview</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <Link href="/client" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-5">
          <ArrowLeft className="h-3 w-3" /> Back to overview
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">New Service Request</h1>
        <p className="text-sm text-muted-foreground mt-1">Submit a request and our team will contact you to confirm scheduling.</p>
      </div>

      <form className="space-y-8" onSubmit={handleSubmit} noValidate>

        {/* Contact Details */}
        <section className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Contact Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs">
                Contact name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name" name="name"
                placeholder="David Park"
                className={cn("h-10 text-sm", errors.name && "border-destructive")}
                onChange={() => clearError("name")}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company" className="text-xs">Company name</Label>
              <Input id="company" name="company" placeholder="Metro Security Ltd" defaultValue="Metro Security Ltd" className="h-10 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">
                Phone number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone" name="phone" type="tel"
                placeholder="555-1001"
                className={cn("h-10 text-sm", errors.phone && "border-destructive")}
                onChange={() => clearError("phone")}
              />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Email address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email" name="email" type="email"
                placeholder="d.park@metro.com"
                className={cn("h-10 text-sm", errors.email && "border-destructive")}
                onChange={() => clearError("email")}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Service Details */}
        <section className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Service Details</p>

          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs">
              Site address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address" name="address"
              placeholder="123 Main St, Suite 5, City"
              className={cn("h-10 text-sm", errors.address && "border-destructive")}
              onChange={() => clearError("address")}
            />
            {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Service type <span className="text-destructive">*</span>
              </Label>
              <Select value={serviceType} onValueChange={v => { setServiceType(v ?? ""); clearError("serviceType"); }}>
                <SelectTrigger className={cn("h-10 text-sm", errors.serviceType && "border-destructive")}>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.serviceType && <p className="text-xs text-destructive">{errors.serviceType}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Urgency <span className="text-destructive">*</span>
              </Label>
              <Select value={urgency} onValueChange={v => { setUrgency(v ?? ""); clearError("urgency"); }}>
                <SelectTrigger className={cn("h-10 text-sm", errors.urgency && "border-destructive")}>
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  {URGENCY_LEVELS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.urgency && <p className="text-xs text-destructive">{errors.urgency}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs">
              Issue description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description" name="description"
              placeholder="Describe the issue — which cameras, what the problem is, when it started, and any relevant context…"
              className={cn("min-h-[100px] text-sm resize-none", errors.description && "border-destructive")}
              onChange={() => clearError("description")}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="preferred" className="text-xs">Preferred date / time</Label>
            <Input id="preferred" name="preferred" type="datetime-local" className="h-10 text-sm" />
          </div>
        </section>

        <div className="h-px bg-border" />

        {/* Photo upload placeholder */}
        <section className="space-y-1.5">
          <Label className="text-xs">Attach photos (optional)</Label>
          <div className="flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-border bg-muted/15 px-6 py-10 text-center">
            <Camera className="h-7 w-7 text-muted-foreground/50" />
            <div>
              <p className="text-sm text-muted-foreground font-medium">Photo upload</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Available after account setup</p>
            </div>
          </div>
        </section>

        <Button type="submit" className="w-full h-11 text-sm font-medium">
          Submit Request
        </Button>

      </form>
    </div>
  );
}
