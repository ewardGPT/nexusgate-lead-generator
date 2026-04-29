import { supabase } from "./supabase";

function normalizePhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits || null;
}

export async function leadExistsForUser(params: {
  userId: string;
  phone?: string | null;
  businessName: string;
  city?: string | null;
}) {
  const normalizedPhone = normalizePhone(params.phone);
  const byPhone = normalizedPhone
    ? await supabase.from("leads").select("id").eq("user_id", params.userId).eq("phone", normalizedPhone).maybeSingle()
    : { data: null };

  if (byPhone.data?.id) return true;

  const byNameCity = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", params.userId)
    .ilike("business_name", params.businessName.trim())
    .ilike("city", (params.city ?? "").trim())
    .maybeSingle();

  return Boolean(byNameCity.data?.id);
}
