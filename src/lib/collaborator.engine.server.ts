import { adminClient, isSupabaseServerConfigured } from "./supabase.server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

export type ResolvedCollaborator = {
  id: string;
  code: string;
  user_id: string;
  name: string;
  email: string;
};

/**
 * Safely resolves a collaborator link by code or id without triggering
 * Postgres 22P02 "invalid input syntax for type uuid" errors.
 */
export async function resolveCollaboratorLink(
  codeOrId?: string | null,
): Promise<ResolvedCollaborator | null> {
  if (!codeOrId || !isSupabaseServerConfigured()) return null;
  const clean = codeOrId.trim();
  if (!clean) return null;

  const db = adminClient();

  // 1. Direct query using safe type checking
  try {
    let query = db
      .from("collaborator_links")
      .select("id, code, user_id, name, email, active")
      .eq("active", true);

    if (isValidUuid(clean)) {
      query = query.or(`code.eq.${clean},id.eq.${clean}`);
    } else {
      query = query.eq("code", clean);
    }

    const { data, error } = await query.maybeSingle();
    if (!error && data?.id) {
      return {
        id: String(data.id),
        code: String(data.code),
        user_id: String(data.user_id),
        name: String(data.name || ""),
        email: String(data.email || ""),
      };
    }
  } catch (err) {
    console.warn("Collaborator link lookup warning:", err);
  }

  // 2. Case-insensitive code search
  try {
    const { data, error } = await db
      .from("collaborator_links")
      .select("id, code, user_id, name, email, active")
      .ilike("code", clean)
      .eq("active", true)
      .maybeSingle();

    if (!error && data?.id) {
      return {
        id: String(data.id),
        code: String(data.code),
        user_id: String(data.user_id),
        name: String(data.name || ""),
        email: String(data.email || ""),
      };
    }
  } catch {
    // Ignore
  }

  // 3. Match by collaborator name
  try {
    const { data, error } = await db
      .from("collaborator_links")
      .select("id, code, user_id, name, email, active")
      .ilike("name", clean)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.id) {
      return {
        id: String(data.id),
        code: String(data.code),
        user_id: String(data.user_id),
        name: String(data.name || ""),
        email: String(data.email || ""),
      };
    }
  } catch {
    // Ignore
  }

  // 4. Match by partner email if code wasn't found
  if (clean.includes("@")) {
    try {
      const { data, error } = await db
        .from("collaborator_links")
        .select("id, code, user_id, name, email, active")
        .ilike("email", clean)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data?.id) {
        return {
          id: String(data.id),
          code: String(data.code),
          user_id: String(data.user_id),
          name: String(data.name || ""),
          email: String(data.email || ""),
        };
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Ultra-intelligent fallback resolver: if no explicit code was passed,
 * deduce collaborator attribution from prior user activity or sessions.
 */
export async function intelligentResolveCollaborator(params: {
  collaboratorCode?: string | null;
  userId?: string | null;
  customerEmail?: string | null;
  sessionId?: string | null;
}): Promise<ResolvedCollaborator | null> {
  if (!isSupabaseServerConfigured()) return null;

  // A. If code provided directly, resolve it
  if (params.collaboratorCode) {
    const direct = await resolveCollaboratorLink(params.collaboratorCode);
    if (direct) return direct;
  }

  const db = adminClient();

  // B. Check if userId was previously attributed
  if (params.userId && isValidUuid(params.userId)) {
    try {
      const { data } = await db
        .from("page_views")
        .select("collaborator_link_id, collaborator_code")
        .eq("user_id", params.userId)
        .not("collaborator_link_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.collaborator_link_id) {
        const resolved = await resolveCollaboratorLink(data.collaborator_link_id);
        if (resolved) return resolved;
      }
      if (data?.collaborator_code) {
        const resolved = await resolveCollaboratorLink(data.collaborator_code);
        if (resolved) return resolved;
      }
    } catch {
      // Ignore
    }
  }

  // C. Check if customerEmail was previously attributed
  if (params.customerEmail && params.customerEmail.includes("@")) {
    try {
      // Check if this email exists as a profile user
      const { data: profile } = await db
        .from("profiles")
        .select("id")
        .ilike("email", params.customerEmail.trim())
        .maybeSingle();

      if (profile?.id) {
        const resolved = await intelligentResolveCollaborator({ userId: profile.id });
        if (resolved) return resolved;
      }
    } catch {
      // Ignore
    }

    try {
      // Check past orders for this email that had a collaborator
      const { data: pastOrder } = await db
        .from("orders")
        .select("collaborator_link_id")
        .ilike("customer_email", params.customerEmail.trim())
        .not("collaborator_link_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pastOrder?.collaborator_link_id) {
        const resolved = await resolveCollaboratorLink(pastOrder.collaborator_link_id);
        if (resolved) return resolved;
      }
    } catch {
      // Ignore
    }
  }

  // D. Check if anonymous sessionId had a collaborator link
  if (params.sessionId) {
    try {
      const { data } = await db
        .from("page_views")
        .select("collaborator_link_id, collaborator_code")
        .eq("session_id", params.sessionId)
        .not("collaborator_link_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data?.collaborator_link_id) {
        const resolved = await resolveCollaboratorLink(data.collaborator_link_id);
        if (resolved) return resolved;
      }
      if (data?.collaborator_code) {
        const resolved = await resolveCollaboratorLink(data.collaborator_code);
        if (resolved) return resolved;
      }
    } catch {
      // Ignore
    }
  }

  return null;
}

/**
 * Broadcasts an instant event across the Supabase Realtime channel
 * to trigger immediate sub-second cache invalidations for admin & collaborator dashboards.
 */
export function broadcastCollaboratorRealtimeEvent(
  event: string,
  payload: Record<string, unknown>,
) {
  if (!isSupabaseServerConfigured()) return;
  try {
    const channel = adminClient().channel("collaborator-realtime-sync");
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel
          .send({
            type: "broadcast",
            event: "collaborator_update",
            payload: { event, ...payload, timestamp: Date.now() },
          })
          .then(() => {
            channel.unsubscribe();
          })
          .catch(() => {
            channel.unsubscribe();
          });
      }
    });
  } catch (err) {
    console.warn("Realtime broadcast notification notice:", err);
  }
}

/**
 * Instantly records a user sign-up via collaborator link, binds the session,
 * stitches prior anonymous views, and triggers immediate real-time reflection.
 */
export async function recordCollaboratorSignupServer(input: {
  userId: string;
  email?: string | null;
  collaboratorCode?: string | null;
  sessionId?: string | null;
  fullName?: string | null;
}) {
  if (!isSupabaseServerConfigured()) {
    return { ok: false, message: "Supabase not configured" };
  }
  const db = adminClient();
  const userId = input.userId?.trim();
  if (!userId || !isValidUuid(userId)) {
    return { ok: false, message: "Invalid user ID" };
  }

  // Resolve collaborator link (via direct code or intelligent session resolution)
  const link = await intelligentResolveCollaborator({
    collaboratorCode: input.collaboratorCode,
    sessionId: input.sessionId,
    customerEmail: input.email,
    userId,
  });

  if (!link) {
    return { ok: false, message: "No collaborator link detected" };
  }

  try {
    // 1. Check if sign-up was already recorded for this user and link
    const { data: existing } = await db
      .from("page_views")
      .select("id")
      .eq("user_id", userId)
      .eq("collaborator_link_id", link.id)
      .limit(1)
      .maybeSingle();

    if (!existing) {
      // Insert authoritative signup event
      await db.from("page_views").insert({
        path: "/auth/signup",
        session_id: input.sessionId || null,
        user_id: userId,
        collaborator_code: link.code,
        collaborator_link_id: link.id,
      });
    }

    // 2. Stitch prior anonymous views from this session
    if (input.sessionId) {
      await db
        .from("page_views")
        .update({
          user_id: userId,
          collaborator_link_id: link.id,
          collaborator_code: link.code,
        })
        .eq("session_id", input.sessionId);
    }

    // 3. Broadcast instant real-time notification
    broadcastCollaboratorRealtimeEvent("signup", {
      linkId: link.id,
      code: link.code,
      userId,
      email: input.email,
    });

    return { ok: true, linkId: link.id, code: link.code };
  } catch (err) {
    console.error("Failed to record collaborator signup:", err);
    return { ok: false, error: String(err) };
  }
}

/**
 * Auto-heals orders that belong to collaborator signups but were missing collaborator_link_id.
 */
export async function autoHealCollaboratorOrders(): Promise<number> {
  if (!isSupabaseServerConfigured()) return 0;
  const db = adminClient();
  let healed = 0;

  try {
    // 1. Find recent orders where collaborator_link_id is NULL
    const { data: orphanedOrders, error: orderErr } = await db
      .from("orders")
      .select("id, user_id, customer_email, created_at")
      .is("collaborator_link_id", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (orderErr || !orphanedOrders || orphanedOrders.length === 0) return 0;

    for (const order of orphanedOrders) {
      const link = await intelligentResolveCollaborator({
        userId: order.user_id,
        customerEmail: order.customer_email,
      });

      if (link?.id) {
        await db.from("orders").update({ collaborator_link_id: link.id }).eq("id", order.id);
        healed += 1;
      }
    }

    if (healed > 0) {
      broadcastCollaboratorRealtimeEvent("autoheal_orders", { count: healed });
    }
  } catch (err) {
    console.warn("Collaborator auto-heal notice:", err);
  }

  return healed;
}
