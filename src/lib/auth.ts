import { requireSupabase } from "@/integrations/supabase/client";
import { getReferralCode } from "@/lib/referral";

export async function signUp(email: string, password: string, fullName?: string) {
  const refCode = getReferralCode();
  const metadata: Record<string, unknown> = {};
  if (fullName) metadata.full_name = fullName;
  if (refCode) metadata.collaborator_code = refCode;

  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: Object.keys(metadata).length ? metadata : undefined,
    },
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithGoogle() {
  const { data, error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { access_type: "offline", prompt: "consent" },
    },
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(email: string) {
  const { data, error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await requireSupabase().auth.signOut();
  if (error) throw error;
}
