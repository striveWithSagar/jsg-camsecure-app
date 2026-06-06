import { createClient } from "@/lib/supabase/server";

export type OrgSettings = {
  orgId:             string;
  businessName:      string;
  phone:             string;
  address:           string;
  invoiceFooterNote: string;
  companySettingsId: string;
  googleReviewUrl:   string;
};

export async function getOrgSettings(): Promise<OrgSettings | null> {
  const supabase = await createClient();

  const [orgResult, csResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, phone, address")
      .single(),
    supabase
      .from("company_settings")
      .select("id, business_name, invoice_footer_note, google_review_url")
      .single(),
  ]);

  if (orgResult.error || csResult.error) {
    console.error("[getOrgSettings] org:", orgResult.error?.message);
    console.error("[getOrgSettings] cs:", csResult.error?.message);
    return null;
  }

  const org = orgResult.data;
  const cs  = csResult.data;

  return {
    orgId:             org.id,
    businessName:      cs.business_name       ?? "",
    phone:             org.phone              ?? "",
    address:           org.address            ?? "",
    invoiceFooterNote: cs.invoice_footer_note ?? "",
    companySettingsId: cs.id,
    googleReviewUrl:   cs.google_review_url   ?? "",
  };
}
