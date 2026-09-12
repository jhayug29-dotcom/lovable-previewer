import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.object({ accessToken: z.string().optional() });

export const checkPanelAccess = createServerFn({ method: "POST" }).validator((data) => token.parse(data)).handler(async ({ data }) => (await import("./analytics.server")).panelAccess(data.accessToken));
export const fetchAnalytics = createServerFn({ method: "POST" }).validator((data) => token.parse(data)).handler(async ({ data }) => (await import("./analytics.server")).getAnalytics(data.accessToken));
export const fetchSellers = createServerFn({ method: "POST" }).validator((data) => token.parse(data)).handler(async ({ data }) => (await import("./analytics.server")).listSellers(data.accessToken));
export const saveSellerProducts = createServerFn({ method: "POST" }).validator((data) => token.extend({ userId: z.string().uuid(), productIds: z.array(z.string().uuid()) }).parse(data)).handler(async ({ data }) => (await import("./analytics.server")).setSellerProducts(data.accessToken, data.userId, data.productIds));
export const listCollaboratorLinks = createServerFn({ method: "POST" }).validator((data) => token.parse(data)).handler(async ({ data }) => (await import("./collaborator.server")).listCollaboratorLinks(data.accessToken));
export const listCollaboratorPartners = createServerFn({ method: "POST" }).validator((data) => token.parse(data)).handler(async ({ data }) => (await import("./collaborator.server")).listCollaboratorPartners(data.accessToken));
export const createCollaboratorLink = createServerFn({ method: "POST" }).validator((data) => token.extend({ name: z.string().trim().min(2).max(80), email: z.string().trim().email() }).parse(data)).handler(async ({ data }) => (await import("./collaborator.server")).createCollaboratorLink(data.accessToken, data.name, data.email));
export const toggleCollaboratorLink = createServerFn({ method: "POST" }).validator((data) => token.extend({ id: z.string().uuid(), active: z.boolean() }).parse(data)).handler(async ({ data }) => (await import("./collaborator.server")).toggleCollaboratorLink(data.accessToken, data.id, data.active));
export const fetchCollaboratorLinkStats = createServerFn({ method: "POST" }).validator((data) => token.extend({ id: z.string().uuid() }).parse(data)).handler(async ({ data }) => (await import("./collaborator.server")).getCollaboratorLinkStats(data.accessToken, data.id));
export const saveCollaboratorProductAccess = createServerFn({ method: "POST" }).validator((data) => token.extend({ userId: z.string().uuid(), productIds: z.array(z.string().uuid()) }).parse(data)).handler(async ({ data }) => (await import("./collaborator.server")).setCollaboratorProductAccess(data.accessToken, data.userId, data.productIds));
export const fetchCollaboratorDashboard = createServerFn({ method: "POST" }).validator((data) => token.parse(data)).handler(async ({ data }) => (await import("./collaborator.server")).getCollaboratorDashboard(data.accessToken));
