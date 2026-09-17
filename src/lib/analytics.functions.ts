import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.object({ accessToken: z.string().optional() });

const analyticsFilterSchema = z.object({
  accessToken: z.string().optional(),
  timeframe: z.enum(["today", "7d", "1m", "3m", "10m", "custom"]).default("1m"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

export const checkPanelAccess = createServerFn({ method: "POST" })
  .validator((d) => token.parse(d))
  .handler(async ({ data }) => (await import("./analytics.server")).panelAccess(data.accessToken));

export const fetchAnalytics = createServerFn({ method: "POST" })
  .validator((d) => analyticsFilterSchema.parse(d))
  .handler(async ({ data }) =>
    (await import("./analytics.live.server")).getLiveAnalytics(
      data.accessToken,
      data.timeframe,
      data.startDate,
      data.endDate,
    ),
  );

export const syncAndRestoreAnalytics = createServerFn({ method: "POST" })
  .validator((d) => token.parse(d))
  .handler(async ({ data }) =>
    (await import("./analytics.server")).syncAndRestoreAnalyticsServer(data.accessToken),
  );

export const fetchSellers = createServerFn({ method: "POST" })
  .validator((d) => token.parse(d))
  .handler(async ({ data }) => (await import("./analytics.server")).listSellers(data.accessToken));

export const saveSellerProducts = createServerFn({ method: "POST" })
  .validator((d) =>
    token.extend({ userId: z.string().uuid(), productIds: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data }) =>
    (await import("./analytics.server")).setSellerProducts(
      data.accessToken,
      data.userId,
      data.productIds,
    ),
  );

export const listCollaboratorLinks = createServerFn({ method: "POST" })
  .validator((d) => analyticsFilterSchema.parse(d))
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).listCollaboratorLinks(
      data.accessToken,
      data.timeframe,
      data.startDate,
      data.endDate,
    ),
  );

export const listCollaboratorPartners = createServerFn({ method: "POST" })
  .validator((d) => analyticsFilterSchema.parse(d))
  .handler(async ({ data }) =>
    (await import("./collaborator.admin.server")).listCollaboratorPartnersAdmin(
      data.accessToken,
      data.timeframe,
      data.startDate,
      data.endDate,
    ),
  );

export const listCollaboratorProducts = createServerFn({ method: "POST" })
  .validator((d) => token.parse(d))
  .handler(async ({ data }) =>
    (await import("./collaborator.admin.server")).listCollaboratorProductsAdmin(data.accessToken),
  );

export const createCollaboratorLink = createServerFn({ method: "POST" })
  .validator((d) =>
    token
      .extend({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().optional(),
        userId: z.string().uuid().optional(),
        productIds: z.array(z.string().uuid()).default([]),
      })
      .refine((v) => Boolean(v.userId || v.email), {
        message: "A registered user or email is required",
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    (await import("./collaborator.admin.server")).createCollaboratorLinkAdmin(
      data.accessToken,
      data.name,
      data.email,
      data.userId,
      data.productIds,
    ),
  );

export const toggleCollaboratorLink = createServerFn({ method: "POST" })
  .validator((d) =>
    token
      .extend({
        id: z.string().uuid().optional(),
        linkId: z.string().uuid().optional(),
        active: z.boolean(),
      })
      .refine((v) => Boolean(v.id || v.linkId), {
        message: "Link ID is required",
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const targetId = (data.id || data.linkId)!;
    return (await import("./collaborator.server")).toggleCollaboratorLink(
      data.accessToken,
      targetId,
      data.active,
    );
  });

export const revokeCollaboratorPartner = createServerFn({ method: "POST" })
  .validator((d) => token.extend({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).revokeCollaboratorPartner(
      data.accessToken,
      data.userId,
    ),
  );

export const fetchCollaboratorLinkStats = createServerFn({ method: "POST" })
  .validator((d) =>
    token
      .extend({
        id: z.string().uuid(),
        timeframe: z.enum(["today", "7d", "1m", "3m", "10m", "custom"]).default("1m"),
        startDate: z.string().optional().nullable(),
        endDate: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).getCollaboratorLinkStats(
      data.accessToken,
      data.id,
      data.timeframe,
      data.startDate,
      data.endDate,
    ),
  );

export const saveCollaboratorProductAccess = createServerFn({ method: "POST" })
  .validator((d) =>
    token.extend({ userId: z.string().uuid(), productIds: z.array(z.string().uuid()) }).parse(d),
  )
  .handler(async ({ data }) =>
    (await import("./collaborator.admin.server")).setCollaboratorProductAccessAdmin(
      data.accessToken,
      data.userId,
      data.productIds,
    ),
  );

export const fetchCollaboratorDashboard = createServerFn({ method: "POST" })
  .validator((d) => analyticsFilterSchema.parse(d))
  .handler(async ({ data }) =>
    (await import("./collaborator.admin.server")).getCollaboratorDashboardAdmin(
      data.accessToken,
      data.timeframe,
      data.startDate,
      data.endDate,
    ),
  );

export const recordPageView = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        path: z.string(),
        sessionId: z.string().optional(),
        userId: z.string().nullable().optional(),
        collaboratorCode: z.string().nullable().optional(),
        collaboratorLinkId: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { recordPageViewServer } = await import("./analytics.server");
    return recordPageViewServer(data);
  });

export const resolveCollaboratorDetails = createServerFn({ method: "GET" })
  .validator((d) => z.object({ code: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { resolveCollaboratorLink } = await import("./collaborator.engine.server");
    const resolved = await resolveCollaboratorLink(data.code);
    if (!resolved) return null;
    return { name: resolved.name, code: resolved.code };
  });

export const recordCollaboratorSignup = createServerFn({ method: "POST" })
  .validator((d) =>
    z
      .object({
        userId: z.string(),
        email: z.string().optional().nullable(),
        collaboratorCode: z.string().optional().nullable(),
        sessionId: z.string().optional().nullable(),
        fullName: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { recordCollaboratorSignupServer } = await import("./collaborator.engine.server");
    return recordCollaboratorSignupServer(data);
  });
