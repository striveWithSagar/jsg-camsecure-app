import { createClient } from "@/lib/supabase/server";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  new_installation:  "New Installation",
  maintenance:       "Maintenance",
  dvr_nvr_issue:     "DVR/NVR Issue",
  camera_outage:     "Camera Outage",
  mobile_app_issue:  "Mobile App Issue",
  wiring_issue:      "Wiring Issue",
  emergency_service: "Emergency Service",
  quote_request:     "Quote Request",
  site_inspection:   "Site Inspection",
  other:             "Other",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type InvoiceRow = {
  id:       string;
  number:   string;
  client:   string;
  jobLabel: string;
  total:    number;
  status:   string;
  issued:   string;
  due:      string;
};

export type InvoiceSummary = {
  unpaidAmount:  number;
  overdueAmount: number;
  paidAmount:    number;
  unpaidCount:   number;
  overdueCount:  number;
  paidCount:     number;
  totalCount:    number;
};

export type InvoiceListData = {
  invoices: InvoiceRow[];
  summary:  InvoiceSummary;
};

export async function getInvoiceList(): Promise<InvoiceListData> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, status, total, issued_at, due_at, clients(name), jobs(service_type)")
    .order("issued_at", { ascending: false, nullsFirst: false });

  if (error) {
    console.error("[getInvoiceList]", error.message);
    return {
      invoices: [],
      summary: {
        unpaidAmount: 0, overdueAmount: 0, paidAmount: 0,
        unpaidCount: 0,  overdueCount: 0,  paidCount: 0,
        totalCount: 0,
      },
    };
  }

  type ClientEmbed = { name: string } | { name: string }[] | null;
  type JobEmbed    = { service_type: string } | { service_type: string }[] | null;
  type RawRow = {
    id:             string;
    invoice_number: string;
    status:         string;
    total:          string | number;
    issued_at:      string | null;
    due_at:         string | null;
    clients:        ClientEmbed;
    jobs:           JobEmbed;
  };

  function extractClientName(c: ClientEmbed): string {
    if (!c) return "—";
    if (Array.isArray(c)) return c[0]?.name ?? "—";
    return c.name ?? "—";
  }

  function extractJobLabel(j: JobEmbed): string {
    if (!j) return "—";
    const row = Array.isArray(j) ? j[0] : j;
    if (!row) return "—";
    return SERVICE_TYPE_LABELS[row.service_type] ?? row.service_type;
  }

  const rows = (data ?? []) as unknown as RawRow[];

  const invoices: InvoiceRow[] = rows.map(row => ({
    id:       row.id,
    number:   row.invoice_number,
    client:   extractClientName(row.clients),
    jobLabel: extractJobLabel(row.jobs),
    total:    Number(row.total) || 0,
    status:   row.status,
    issued:   formatDate(row.issued_at),
    due:      formatDate(row.due_at),
  }));

  const summary: InvoiceSummary = {
    unpaidAmount:  invoices.filter(i => i.status === "unpaid").reduce((s, i) => s + i.total, 0),
    overdueAmount: invoices.filter(i => i.status === "overdue").reduce((s, i) => s + i.total, 0),
    paidAmount:    invoices.filter(i => i.status === "paid").reduce((s, i) => s + i.total, 0),
    unpaidCount:   invoices.filter(i => i.status === "unpaid").length,
    overdueCount:  invoices.filter(i => i.status === "overdue").length,
    paidCount:     invoices.filter(i => i.status === "paid").length,
    totalCount:    invoices.length,
  };

  return { invoices, summary };
}
