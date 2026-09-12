import { getDbClient, requireAdmin } from "./supabase.server";

const code = () => `${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}${Date.now().toString(36)}`;

export async function listCollaboratorLinks(accessToken?: string) {
  await requireAdmin(accessToken);
  const db = getDbClient(accessToken);
  const { data, error } = await db.from("collaborator_links").select("id,code,name,user_id,email,active,created_at").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, visitors: 0, page_views: 0, sales: 0, revenue: 0 }));
}

export async function createCollaboratorLink(accessToken: string | undefined, name: string, email: string) {
  await requireAdmin(accessToken);
  const db = getDbClient(accessToken);
  const { data: profile, error: profileError } = await db.from("profiles").select("id,email").eq("email", email.toLowerCase()).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("No registered user was found for that email");
  const { data, error } = await db.from("collaborator_links").insert({ name, email: email.toLowerCase(), user_id: profile.id, code: code() }).select("id,code,name,user_id,email,active,created_at").single();
  if (error) throw error;
  return { ...data, url: `/?ref=${data.code}` };
}

export async function toggleCollaboratorLink(accessToken: string | undefined, id: string, active: boolean) {
  await requireAdmin(accessToken);
  const { data, error } = await getDbClient(accessToken).from("collaborator_links").update({ active }).eq("id", id).select("id,active").single();
  if (error) throw error;
  return data;
}
