export const PRIORITY_LABELS = {
  emergency: "Emergency",
  high: "High",
  medium: "Medium",
  low: "Low",
} as const;

export const STATUS_LABELS = {
  assigned: "Assigned",
  on_the_way: "On the Way",
  started: "Started",
  in_progress: "In Progress",
  needs_parts: "Needs Parts",
  completed: "Completed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
} as const;

export const REQUEST_STATUS_LABELS = {
  new:               "New",
  reviewing:         "Reviewing",
  ready_to_schedule: "Ready to Schedule",
  converted:         "Converted to Job",
  cancelled:         "Cancelled",
} as const;

export const SERVICE_TYPES = [
  "New Installation",
  "Maintenance",
  "DVR/NVR Issue",
  "Camera Outage",
  "Mobile App Issue",
  "Wiring Issue",
  "Emergency Service",
  "Quote Request",
  "Site Inspection",
  "Other",
] as const;

export const URGENCY_LEVELS = ["Emergency", "High", "Medium", "Low"] as const;

export const PRIORITY_BADGE_CLASS: Record<string, string> = {
  emergency: "badge-emergency",
  high: "badge-high",
  medium: "badge-medium",
  low: "badge-low",
};

export const STATUS_BADGE_CLASS: Record<string, string> = {
  assigned: "badge-assigned",
  on_the_way: "badge-on-the-way",
  started: "badge-started",
  in_progress: "badge-in-progress",
  needs_parts: "badge-needs-parts",
  completed: "badge-completed",
  rescheduled: "badge-rescheduled",
  cancelled: "badge-rescheduled",
};

export const NAV_ITEMS = [
  { label: "Dashboard",        href: "/dashboard",   icon: "LayoutDashboard" },
  { label: "Service Requests", href: "/requests",    icon: "Inbox" },
  { label: "Job Board",        href: "/jobs",         icon: "KanbanSquare" },
  { label: "Clients",          href: "/clients",      icon: "Users" },
  { label: "Technicians",      href: "/technicians",  icon: "HardHat" },
  { label: "Invoices",         href: "/invoices",     icon: "Receipt" },
  { label: "Settings",         href: "/settings",     icon: "Settings" },
] as const;

