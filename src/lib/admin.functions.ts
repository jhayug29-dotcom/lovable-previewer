import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.object({ accessToken: z.string().optional() });
const withUser = token.extend({ userId: z.string().uuid() });

/** Server-side gate for the /admin route. Never trust the client alone. */
export const checkAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { isAdminToken } = await import("./admin.server");
    return { admin: await isAdminToken(data.accessToken) };
  });

export const listAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((data) => token.parse(data))
  .handler(async ({ data }) => {
    const { listUsers } = await import("./admin.server");
    return listUsers(data.accessToken);
  });

export const grantAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => withUser.parse(data))
  .handler(async ({ data }) => {
    const { grantAdmin } = await import("./admin.server");
    return grantAdmin(data.accessToken, data.userId);
  });

export const revokeAdminAccess = createServerFn({ method: "POST" })
  .inputValidator((data) => withUser.parse(data))
  .handler(async ({ data }) => {
    const { revokeAdmin } = await import("./admin.server");
    return revokeAdmin(data.accessToken, data.userId);
  });
