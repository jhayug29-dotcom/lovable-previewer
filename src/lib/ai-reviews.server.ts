import { requireAdmin, adminClient } from "./supabase.server";

const MODEL = "gemini-flash-latest";

export type GeneratedReview = { name: string; handle: string; rating: number; body: string };

export async function generateReviews(input: {
  accessToken?: string | undefined;
  productId: string;
  productTitle: string;
  description: string;
  count: number;
  save: boolean;
}): Promise<GeneratedReview[]> {
  await requireAdmin(input.accessToken);

  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const count = Math.min(Math.max(input.count, 1), 12);
  const prompt = `You write short, believable customer reviews for a digital-asset store.
Product: "${input.productTitle}".
Context from the seller: ${input.description}

Return ONLY valid JSON: an array of ${count} objects with keys "name", "handle", "rating", "body".
- name: realistic first + last name, mix Indian and international names
- handle: an @username matching the person, lowercase, no spaces
- rating: integer 4 or 5 (make roughly 1 in 5 a 4)
- body: 1-2 sentences, 12-30 words, specific about editing workflow, no emojis, no marketing tone`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 1 },
      }),
    },
  );

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message ?? "AI request failed");

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
  let parsed: GeneratedReview[];
  try {
    parsed = JSON.parse(text) as GeneratedReview[];
  } catch {
    throw new Error("The AI returned an unexpected format — try again");
  }

  const reviews = parsed.slice(0, count).map((r) => ({
    name: String(r.name ?? "Anonymous"),
    handle: String(r.handle ?? "").replace(/^@?/, "@"),
    rating: Math.min(5, Math.max(1, Number(r.rating ?? 5))),
    body: String(r.body ?? ""),
  }));

  if (input.save && reviews.length > 0) {
    const db = adminClient();
    await db.from("reviews").insert(reviews.map((r) => ({ ...r, product_id: input.productId })));
  }

  return reviews;
}
