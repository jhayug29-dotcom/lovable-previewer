import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const askSupportBot = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
          .min(1)
          .max(20),
        topic: z.enum(["question", "payment", "complaint"]),
        email: z.string().email().optional(),
        name: z.string().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { askSupport } = await import("./support.server");
    return askSupport(data);
  });
