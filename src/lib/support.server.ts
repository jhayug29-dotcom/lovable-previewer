import { adminClient } from "./supabase.server";

const MODEL = "gemini-2.5-flash";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type SupportInput = {
  messages: ChatTurn[];
  topic: "question" | "payment" | "complaint";
  email?: string | undefined;
  name?: string | undefined;
};

const TOPIC_HINT: Record<SupportInput["topic"], string> = {
  question: "The visitor has a general question about the store, products or downloads.",
  payment: "The visitor has a payment or download problem. Be reassuring, ask for their order id and the email used at checkout, and tell them the team verifies payments and re-sends download links.",
  complaint: "The visitor is filing a complaint. Apologise once, be concise, collect the details, and confirm the team will reply by email.",
};

async function storeContext(): Promise<string> {
  try {
    const db = adminClient();
    const [products, settings, sale] = await Promise.all([
      db.from("products").select("title, category, price, is_free, tagline").eq("active", true).limit(40),
      db.from("site_settings").select("*").eq("id", "global").maybeSingle(),
      db.from("sales").select("title, sale_type, percent_off, flat_price").eq("active", true).limit(1).maybeSingle(),
    ]);
    const list = (products.data ?? [])
      .map((p) => `- ${String(p['title'])} (${String(p['category'])}) — ${p['is_free'] ? "Free" : `₹${String(p['price'])}`}: ${String(p['tagline'] ?? "")}`)
      .join("\n");
    const s = settings.data as Record<string, string> | null;
    const saleLine = sale.data
      ? `Live sale: ${String(sale.data['title'])} (${sale.data['sale_type'] === "flat" ? `flat ₹${String(sale.data['flat_price'])}` : `${String(sale.data['percent_off'])}% off`}).`
      : "No sale is running right now.";
    return [
      `Catalog:\n${list || "(catalog unavailable)"}`,
      saleLine,
      s ? `Support email: ${s['support_email'] || s['contact_email'] || ""}. Support hours: ${s['support_hours'] || ""}. WhatsApp: ${s['whatsapp'] || "n/a"}.` : "",
      s?.['refund_policy'] ? `Refund policy: ${s['refund_policy']}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return "";
  }
}

function fallbackReply(topic: SupportInput["topic"]): string {
  if (topic === "payment")
    return "Thanks for reaching out — I've logged your payment issue and our team will verify the transaction and re-send your download link by email. Please include your order ID and the email you paid with.";
  if (topic === "complaint")
    return "Sorry about that. Your complaint has been recorded and the team will get back to you by email shortly.";
  return "Thanks for your message — it's been sent to our team and you'll get a reply by email soon.";
}

export async function askSupport(input: SupportInput): Promise<{ reply: string }> {
  const history = input.messages.slice(-12);
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";

  let reply = "";
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const apiKey = process.env["GEMINI_API_KEY"];

  if ((lovableKey || apiKey) && lastUser) {
    try {
      const context = await storeContext();
      const system = `You are the friendly support assistant for Editly Store, an Indian digital store selling After Effects packs, LUTs, Premiere extensions and SFX packs. Payments run through Cashfree and downloads are emailed instantly after payment.
${TOPIC_HINT[input.topic]}
Answer in 1-3 short sentences, plain language, no markdown headings. Never invent prices or policies — use the store facts below. If you cannot resolve it, say the team will reply by email.

STORE FACTS:
${context}`;

      if (lovableKey) {
        // Lovable AI Gateway — no separate Gemini key needed.
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableKey}` },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: system },
              ...history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })),
            ],
            max_completion_tokens: 400,
          }),
        });
        const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
        reply = payload.choices?.[0]?.message?.content?.trim() ?? "";
      }

      if (!reply && apiKey) {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: history.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            })),
            generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
          }),
        });
        const payload = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        reply = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
      }
    } catch {
      reply = "";
    }
  }


  if (!reply) reply = fallbackReply(input.topic);

  // Log the enquiry so the admin panel can follow up. Never block the reply on it.
  try {
    await adminClient()
      .from("support_messages")
      .insert({
        name: input.name ?? "",
        email: input.email ?? "",
        topic: input.topic,
        message: lastUser,
        reply,
      });
  } catch {
    /* logging is best-effort */
  }

  return { reply };
}
