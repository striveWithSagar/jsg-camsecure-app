import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import { getJobsForWeeklyExport }    from "@/lib/data/jobs";
import ExcelJS                       from "exceljs";

// ── Auth guard (same pattern as /api/admin/accounts) ─────────────────────────

async function verifyAdmin(req: NextRequest): Promise<
  | { ok: true;  userId: string; orgId: string }
  | { ok: false; status: 401 | 403; message: string }
> {
  const authHeader  = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let authedClient;
  if (bearerToken) {
    authedClient = createSbClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { global: { headers: { Authorization: `Bearer ${bearerToken}` } }, auth: { autoRefreshToken: false, persistSession: false } }
    );
  } else {
    authedClient = await createClient();
  }

  const { data: { user }, error: authErr } = await authedClient.auth.getUser();
  if (authErr || !user) return { ok: false, status: 401, message: "Not authenticated" };

  const { data: profile } = await authedClient
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return { ok: false, status: 403, message: "Admin or owner access required" };
  }

  return { ok: true, userId: user.id, orgId: profile.organization_id as string };
}

// ── Label maps ────────────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<string, string> = {
  emergency: "Emergency",
  high:      "High",
  medium:    "Medium",
  low:       "Low",
};

const STATUS_LABEL: Record<string, string> = {
  assigned:    "Assigned",
  on_the_way:  "On the Way",
  started:     "Started",
  in_progress: "In Progress",
  needs_parts: "Needs Parts",
  rescheduled: "Rescheduled",
  completed:   "Completed",
  cancelled:   "Cancelled",
};

const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft:     "Draft",
  unpaid:    "Unpaid",
  paid:      "Paid",
  overdue:   "Overdue",
  cancelled: "Cancelled",
};

// ── Duration helper ───────────────────────────────────────────────────────────

function calcTimeOpen(createdAt: string, completedAt: string | null): string {
  const start = new Date(createdAt).getTime();
  const end   = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms    = Math.max(0, end - start);
  const hours = Math.floor(ms / 3_600_000);
  const days  = Math.floor(hours / 24);
  const rem   = hours % 24;
  if (days > 0) return `${days}d ${rem}h`;
  return `${hours}h`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

// ── GET handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth
  const auth = await verifyAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  // Params
  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end   = searchParams.get("end");

  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!start || !end || !isoDate.test(start) || !isoDate.test(end)) {
    return NextResponse.json(
      { error: "Required query params: start=YYYY-MM-DD&end=YYYY-MM-DD" },
      { status: 400 }
    );
  }

  if (start > end) {
    return NextResponse.json({ error: "start must be before end" }, { status: 400 });
  }

  // Fetch data
  const jobs = await getJobsForWeeklyExport(auth.orgId, start, end);

  // Build workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator  = "JSG CamSecure";
  workbook.created  = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Weekly Jobs Report", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Job #",           key: "job_number",     width: 12  },
    { header: "Client",          key: "client",          width: 26  },
    { header: "Site Name",       key: "site_name",       width: 22  },
    { header: "Address",         key: "address",         width: 32  },
    { header: "Service Type",    key: "service_type",    width: 22  },
    { header: "Priority",        key: "priority",        width: 12  },
    { header: "Status",          key: "status",          width: 16  },
    { header: "Technician",      key: "technician",      width: 22  },
    { header: "Client Preferred", key: "preferred_at",    width: 20  },
    { header: "Scheduled",       key: "scheduled",       width: 20  },
    { header: "Deadline",        key: "deadline_at",     width: 20  },
    { header: "Created",         key: "created",         width: 20  },
    { header: "Completed",       key: "completed",       width: 20  },
    { header: "Time Open",       key: "time_open",       width: 14  },
    { header: "Admin Notes",     key: "admin_notes",     width: 32  },
    { header: "Client Concern",  key: "client_concern",  width: 38  },
    { header: "Technician Notes",key: "tech_notes",      width: 32  },
    { header: "Invoice #",       key: "invoice_number",  width: 14  },
    { header: "Invoice Status",  key: "invoice_status",  width: 16  },
    { header: "Invoice Total",   key: "invoice_total",   width: 14  },
    { header: "Photos",          key: "photo_count",     width: 10  },
    { header: "Export Reason",   key: "export_reason",   width: 22  },
  ];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1E3A5F" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 18;

  // Data rows
  for (const job of jobs) {
    const row = sheet.addRow({
      job_number:     job.jobNumber ? `JOB-${String(job.jobNumber).padStart(4, "0")}` : "—",
      client:         job.client,
      site_name:      job.siteName,
      address:        job.address,
      service_type:   job.serviceType,
      priority:       PRIORITY_LABEL[job.priority] ?? job.priority,
      status:         STATUS_LABEL[job.status]     ?? job.status,
      technician:     job.technician,
      preferred_at:   fmtDateTime(job.preferredAt),
      scheduled:      fmtDateTime(job.scheduledAt),
      deadline_at:    fmtDateTime(job.deadlineAt),
      created:        fmtDateTime(job.createdAt),
      completed:      job.completedAt ? fmtDateTime(job.completedAt) : "Active",
      time_open:      calcTimeOpen(job.createdAt, job.completedAt),
      admin_notes:    job.adminNotes,
      client_concern: job.clientConcern,
      tech_notes:     job.techNotes,
      invoice_number: job.invoiceNumber,
      invoice_status: job.invoiceStatus === "—" ? "—" : (INVOICE_STATUS_LABEL[job.invoiceStatus] ?? job.invoiceStatus),
      invoice_total:  job.invoiceTotal !== null ? `$${job.invoiceTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—",
      photo_count:    job.photoCount,
      export_reason:  job.exportReason,
    });

    // Zebra striping
    if (row.number % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF8FAFC" },
      };
    }

    // Wrap text for notes columns
    (["admin_notes", "client_concern", "tech_notes"] as const).forEach(key => {
      const col = sheet.getColumn(key);
      const cell = row.getCell(col.number);
      cell.alignment = { wrapText: true, vertical: "top" };
    });

    row.height = 16;
  }

  // Empty state row
  if (jobs.length === 0) {
    sheet.addRow({ job_number: "No jobs found for this week." });
  }

  // Stream to buffer
  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `JSG-Weekly-Job-Report-${start}-to-${end}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control":       "no-store",
    },
  });
}
