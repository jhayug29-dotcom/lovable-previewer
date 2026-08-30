import { supabase } from "@/integrations/supabase/client";

/** Contact / support details, editable from the admin panel. */
export type SiteSettings = {
  support_email: string;
  contact_email: string;
  phone: string;
  whatsapp: string;
  address: string;
  support_hours: string;
  instagram: string;
  youtube: string;
  twitter: string;
  refund_policy: string;
  licence_note: string;
};

export const DEFAULT_SETTINGS: SiteSettings = {
  support_email: "growchannel2026@gmail.com",
  contact_email: "growchannel2026@gmail.com",
  phone: "",
  whatsapp: "",
  address: "",
  support_hours: "Mon–Sat, 10:00–19:00 IST",
  instagram: "",
  youtube: "",
  twitter: "",
  refund_policy:
    "Digital products are delivered instantly, so purchases are non-refundable once the download link is used. If a file is broken or missing, email support and we will fix it or refund you in full.",
  licence_note:
    "Every pack ships with a commercial licence: use it in client work, ads and monetised videos. Reselling or redistributing the source files is not allowed.",
};

const TABLE = "site_settings";
const ROW_ID = "global";

/** Reads settings from the database; falls back to defaults when unset. */
export async function fetchSettings(): Promise<SiteSettings> {
  if (!supabase) return DEFAULT_SETTINGS;
  const { data } = await supabase.from(TABLE).select("*").eq("id", ROW_ID).maybeSingle();
  if (!data) return DEFAULT_SETTINGS;
  const row = data as Partial<SiteSettings>;
  const merged = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SiteSettings)[]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) merged[key] = value;
  }
  return merged;
}

/** Admin-only write (RLS enforces the admin role). */
export async function saveSettings(settings: SiteSettings) {
  if (!supabase) throw new Error("Backend not connected yet.");
  const { error } = await supabase
    .from(TABLE)
    .upsert({ id: ROW_ID, ...settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
