import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.object({ accessToken: z.string().optional() });

/** Admin, seller, or collaborator access + the appropriate scope. */
export const checkPanelAccess = createServerFn({ method: "POST" })
  .validator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { panelAccess } = await import("./analytics.server");
    return panelAccess(data.accessToken);
  });

export const fetchAnalytics = createServerFn({ method: "POST" })
  .validator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { getAnalytics } = await import("./analytics.server");
    return getAnalytics(data.accessToken);
  });

export const fetchSellers = createServerFn({ method: "POST" })
  .validator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { listSellers } = await import("./analytics.server");
    return listSellers(data.accessToken);
  });

export const saveSellerProducts = createServerFn({ method: "POST" })
  .validator((data) =>
    token.extend({ userId: z.string().uuid(), productIds: z.array(z.string().uuid()) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { setSellerProducts } = await import("./analytics.server");
    return setSellerProducts(data.accessToken, data.userId, data.productIds);
  });

export const listCollaboratorLinks = createServerFn({ method: "POST" })
  .validator((data) => token.parse(data))
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).listCollaboratorLinks(data.accessToken),
  );

export const createCollaboratorLink = createServerFn({ method: "POST" })
  .validator((data) =>
    token
      .extend({ name: z.string().trim().min(2).max(80), email: z.string().trim().email() })
      .parse(data),
  )
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).createCollaboratorLink(
      data.accessToken,
      data.name,
      data.email,
    ),
  );

export const toggleCollaboratorLink = createServerFn({ method: "POST" })
  .validator((data) =>
    token.extend({ id: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).toggleCollaboratorLink(
      data.accessToken,
      data.id,
      data.active,
    ),
  );

export const fetchCollaboratorLinkStats = createServerFn({ method: "POST" })
  .validator((data) => token.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).getCollaboratorLinkStats(data.accessToken, data.id),
  );

export const fetchCollaboratorDashboard = createServerFn({ method: "POST" })
  .validator((data) => token.parse(data))
  .handler(async ({ data }) =>
    (await import("./collaborator.server")).getCollaboratorDashboard(data.accessToken),
  );
