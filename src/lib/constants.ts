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

/* ─────────────────────────────────────────────
   Mock data — defined in dependency order so
   derived fields (MOCK_TECHNICIANS, MOCK_METRICS)
   can reference earlier arrays directly.
───────────────────────────────────────────── */

export const MOCK_JOBS = [
  // ── Today ──
  { id: "JOB-001", client: "Metro Security Ltd", site: "Downtown Office Tower",  type: "Camera Outage",    priority: "emergency", status: "in_progress", technician: "Alex Rivera",  scheduled: "Today 09:00",    address: "123 Main St, Downtown" },
  { id: "JOB-002", client: "City Bank Branch",   site: "Eastside Branch",        type: "DVR/NVR Issue",    priority: "high",      status: "on_the_way",  technician: "Sam Chen",     scheduled: "Today 11:30",    address: "456 East Ave" },
  { id: "JOB-003", client: "Green Valley Mall",  site: "Main Entrance",          type: "New Installation", priority: "medium",    status: "assigned",    technician: "Jordan Kim",   scheduled: "Today 14:00",    address: "789 Valley Rd" },
  { id: "JOB-004", client: "Harbor Logistics",   site: "Warehouse B",            type: "Wiring Issue",     priority: "low",       status: "needs_parts", technician: "Taylor Reyes", scheduled: "Today 16:00",    address: "10 Harbor Way" },
  { id: "JOB-007", client: "Riverside School",   site: "All Entrances",          type: "New Installation", priority: "high",      status: "started",     technician: "Morgan Davis", scheduled: "Today 13:00",    address: "88 River Rd" },
  { id: "JOB-008", client: "Metro Security Ltd", site: "East Wing Level 3",      type: "DVR/NVR Issue",    priority: "medium",    status: "in_progress", technician: "Alex Rivera",  scheduled: "Today 15:30",    address: "123 Main St, East Wing" },
  { id: "JOB-011", client: "Metro Security Ltd", site: "Lobby Reception",        type: "Camera Outage",    priority: "high",      status: "assigned",    technician: "Sam Chen",     scheduled: "Today 13:30",    address: "123 Main St, Lobby" },

  // ── Upcoming ──
  { id: "JOB-006", client: "Tech Park Office",   site: "Floor 3",                type: "Site Inspection",  priority: "low",       status: "rescheduled", technician: "Sam Chen",     scheduled: "Tomorrow 10:00", address: "200 Tech Park Dr" },
  { id: "JOB-009", client: "Riverside School",   site: "Gymnasium Entrance",     type: "New Installation", priority: "medium",    status: "assigned",    technician: "Alex Rivera",  scheduled: "Tomorrow 09:00", address: "88 River Rd" },
  { id: "JOB-012", client: "Metro Security Ltd", site: "Car Park Level 2",       type: "New Installation", priority: "medium",    status: "assigned",    technician: "Jordan Kim",   scheduled: "Tomorrow 14:00", address: "123 Main St, Car Park" },

  // ── Completed ──
  { id: "JOB-005", client: "Sunrise Hotel",       site: "Lobby & Parking",       type: "Maintenance",      priority: "medium",    status: "completed",   technician: "Alex Rivera",  scheduled: "May 15, 2026",   address: "55 Sunrise Blvd" },
  { id: "JOB-010", client: "Metro Security Ltd",  site: "Parking Structure B",   type: "Maintenance",      priority: "low",       status: "completed",   technician: "Alex Rivera",  scheduled: "May 16, 2026",   address: "123 Main St, Parking" },
  { id: "JOB-013", client: "Metro Security Ltd",  site: "Server Room",           type: "DVR/NVR Issue",    priority: "high",      status: "completed",   technician: "Sam Chen",     scheduled: "May 14, 2026",   address: "123 Main St, Server Room" },
];

export const MOCK_REQUESTS = [
  { id: "REQ-001", client: "Apex Tower Management", phone: "555-0101", type: "Camera Outage",    urgency: "emergency", status: "new",               created: "2 hours ago", description: "3 cameras on floor 5 stopped recording overnight. DVR shows no signal for cameras 5A, 5B, 5C.",     notes: "Premium contract — prioritise. Call David Park before dispatching." },
  { id: "REQ-002", client: "First National Bank",   phone: "555-0202", type: "New Installation", urgency: "medium",    status: "reviewing",         created: "5 hours ago", description: "Requesting 8-camera system for new branch location at 400 Commerce St.",                           notes: "Site survey required first. Sam Chen did their previous install." },
  { id: "REQ-003", client: "Parkview Condos",       phone: "555-0303", type: "DVR/NVR Issue",    urgency: "high",      status: "ready_to_schedule", created: "Yesterday",   description: "DVR not accessible remotely since firmware update on May 14. All remote sessions timing out.",    notes: "Jordan Kim reviewed — firmware rollback needed. Schedule for next available slot." },
  { id: "REQ-004", client: "Sunrise Retail",        phone: "555-0404", type: "Maintenance",      urgency: "low",       status: "converted",         created: "2 days ago",  description: "Annual maintenance check for 12-camera system.",                                                      notes: "Converted to JOB-005. Alex Rivera assigned." },
  { id: "REQ-005", client: "Lakeside Clinic",       phone: "555-0505", type: "Mobile App Issue", urgency: "medium",    status: "new",               created: "3 days ago",  description: "Staff cannot access live feed on iOS and Android. Error: stream timeout after 30 seconds.",        notes: "" },
];

export const MOCK_CLIENTS = [
  { id: "CLT-001", name: "Metro Security Ltd",  contact: "David Park",   email: "d.park@metro.com",      phone: "555-1001", sites: 3, jobs: 12, status: "active" },
  { id: "CLT-002", name: "City Bank Branch",    contact: "Linda Torres", email: "l.torres@citybank.com", phone: "555-1002", sites: 5, jobs: 8,  status: "active" },
  { id: "CLT-003", name: "Green Valley Mall",   contact: "Mike Johnson", email: "m.johnson@gvm.com",     phone: "555-1003", sites: 1, jobs: 5,  status: "active" },
  { id: "CLT-004", name: "Harbor Logistics",    contact: "Sarah Wu",     email: "s.wu@harbor.com",       phone: "555-1004", sites: 2, jobs: 3,  status: "active" },
  { id: "CLT-005", name: "Sunrise Hotel",       contact: "James Lee",    email: "j.lee@sunrise.com",     phone: "555-1005", sites: 1, jobs: 7,  status: "inactive" },
  { id: "CLT-006", name: "Tech Park Office",    contact: "Amy Chen",     email: "a.chen@techpark.com",   phone: "555-1006", sites: 1, jobs: 4,  status: "active" },
];

// activeJobs / completedJobs derived from MOCK_JOBS so they stay in sync with mock data.
// TODO: replace with Supabase queries once auth and schema are finalised.
export const MOCK_TECHNICIANS = [
  { id: "TECH-001", name: "Alex Rivera",  email: "a.rivera@camsecure.com", phone: "555-2001", specialty: "Installation & Networking", status: "on_job",
    activeJobs:    MOCK_JOBS.filter(j => j.technician === "Alex Rivera"  && j.status !== "completed" && j.status !== "cancelled").length,
    completedJobs: MOCK_JOBS.filter(j => j.technician === "Alex Rivera"  && j.status === "completed").length },
  { id: "TECH-002", name: "Sam Chen",     email: "s.chen@camsecure.com",   phone: "555-2002", specialty: "DVR/NVR Systems",           status: "on_the_way",
    activeJobs:    MOCK_JOBS.filter(j => j.technician === "Sam Chen"     && j.status !== "completed" && j.status !== "cancelled").length,
    completedJobs: MOCK_JOBS.filter(j => j.technician === "Sam Chen"     && j.status === "completed").length },
  { id: "TECH-003", name: "Jordan Kim",   email: "j.kim@camsecure.com",    phone: "555-2003", specialty: "CCTV & IP Cameras",         status: "available",
    activeJobs:    MOCK_JOBS.filter(j => j.technician === "Jordan Kim"   && j.status !== "completed" && j.status !== "cancelled").length,
    completedJobs: MOCK_JOBS.filter(j => j.technician === "Jordan Kim"   && j.status === "completed").length },
  { id: "TECH-004", name: "Taylor Reyes", email: "t.reyes@camsecure.com",  phone: "555-2004", specialty: "Access Control",            status: "available",
    activeJobs:    MOCK_JOBS.filter(j => j.technician === "Taylor Reyes" && j.status !== "completed" && j.status !== "cancelled").length,
    completedJobs: MOCK_JOBS.filter(j => j.technician === "Taylor Reyes" && j.status === "completed").length },
  { id: "TECH-005", name: "Morgan Davis", email: "m.davis@camsecure.com",  phone: "555-2005", specialty: "Wiring & Cabling",          status: "on_job",
    activeJobs:    MOCK_JOBS.filter(j => j.technician === "Morgan Davis" && j.status !== "completed" && j.status !== "cancelled").length,
    completedJobs: MOCK_JOBS.filter(j => j.technician === "Morgan Davis" && j.status === "completed").length },
];

export const MOCK_INVOICES = [
  // Metro Security Ltd
  { id: "INV-001", client: "Metro Security Ltd", job: "JOB-010", amount: 2_400, status: "unpaid",  issued: "May 17, 2026", due: "May 31, 2026" },
  { id: "INV-006", client: "Metro Security Ltd", job: "JOB-013", amount: 1_200, status: "paid",    issued: "May 15, 2026", due: "May 29, 2026" },
  { id: "INV-007", client: "Metro Security Ltd", job: "JOB-001", amount: 3_500, status: "unpaid",  issued: "May 14, 2026", due: "May 28, 2026" },
  // Other clients
  { id: "INV-002", client: "City Bank Branch",   job: "JOB-002", amount: 1_850, status: "paid",    issued: "May 10, 2026", due: "May 24, 2026" },
  { id: "INV-003", client: "Sunrise Hotel",      job: "JOB-005", amount:   650, status: "overdue", issued: "Apr 28, 2026", due: "May 12, 2026" },
  { id: "INV-004", client: "Green Valley Mall",  job: "JOB-003", amount: 4_200, status: "unpaid",  issued: "May 13, 2026", due: "May 27, 2026" },
  { id: "INV-005", client: "Harbor Logistics",   job: "JOB-004", amount:   980, status: "paid",    issued: "May 8, 2026",  due: "May 22, 2026" },
];

// Derived from live mock arrays — no drift possible.
// TODO: replace with Supabase aggregates once schema is finalised.
export const MOCK_METRICS = {
  todayJobs:          MOCK_JOBS.filter(j => j.scheduled.startsWith("Today")).length,
  upcomingJobs:       MOCK_JOBS.filter(j => j.scheduled.startsWith("Tomorrow")).length,
  overdueJobs:        MOCK_JOBS.filter(j => j.status === "needs_parts" || j.status === "rescheduled").length,
  emergencyJobs:      MOCK_JOBS.filter(j => j.priority === "emergency" && j.status !== "completed").length,
  openRequests:       MOCK_REQUESTS.filter(r => r.status === "new").length,
  completedThisMonth: MOCK_JOBS.filter(j => j.status === "completed").length,
  unpaidInvoices:     MOCK_INVOICES.filter(i => i.status !== "paid").length,
  monthlyRevenue:     MOCK_INVOICES.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0),
};
