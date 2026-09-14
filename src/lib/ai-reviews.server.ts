import { requireAdmin, adminClient } from "./supabase.server";

export type GeneratedReview = { name: string; handle: string; rating: number; body: string };

const FALLBACK_NAMES = [
  { name: "Aarav Sharma", handle: "@aarav_vfx" },
  { name: "Marcus Vance", handle: "@marcus_edits" },
  { name: "Priya Patel", handle: "@priya_motion" },
  { name: "Rohan Kapoor", handle: "@rohan_cuts" },
  { name: "Elena Rostova", handle: "@elena_post" },
  { name: "Devendra Verma", handle: "@dev_creatives" },
  { name: "Jordan Lee", handle: "@jordan_visuals" },
  { name: "Ananya Iyer", handle: "@ananya_fx" },
  { name: "Liam O'Connor", handle: "@liam_cut" },
  { name: "Siddharth Rao", handle: "@sid_films" },
  { name: "Chloe Bennett", handle: "@chloe_reels" },
  { name: "Tanmay Ghosh", handle: "@tanmay_ae" },
];

const TEMPLATES = [
  "Incredible workflow booster. Integrated into my client timelines seamlessly and saved hours of keyframing.",
  "Top tier quality. The controls are well-organized and the render times are noticeably light.",
  "Exactly what I needed for my recent commercial project. Smooth animation curves and clean project layout.",
  "Super easy to customize and tweak. Every asset in this pack feels professionally crafted.",
  "Replaced three plugins I used to rely on. Clean, fast, and works right out of the box.",
  "The attention to detail in the easing and color science is outstanding. Worth every rupee.",
  "Great customer experience and instant delivery. The project structure is super intuitive.",
  "One of the cleanest asset packs I've purchased this year. Highly recommended for daily editors.",
  "Solid pack! Shaved at least 2 hours off my turnaround for YouTube client edits.",
  "Extremely versatile. Used it across both short-form Reels and a full client corporate video.",
];

function generateSmartFallback(
  title: string,
  description: string,
  count: number,
): GeneratedReview[] {
  const reviews: GeneratedReview[] = [];
  const shuffledNames = [...FALLBACK_NAMES].sort(() => Math.random() - 0.5);

  for (let i = 0; i < count; i++) {
    const person = shuffledNames[i % shuffledNames.length];
    const template = TEMPLATES[i % TEMPLATES.length];
    const rating = i === 2 || i === 7 ? 4 : 5;
    reviews.push({
      name: person.name,
      handle: person.handle,
      rating,
      body: template,
    });
  }
  return reviews;
}

export async function generateReviews(input: {
  accessToken?: string | undefined;
  productId: string;
  productTitle: string;
  description: string;
  count: number;
  save: boolean;
}): Promise<GeneratedReview[]> {
  await requireAdmin(input.accessToken);

  const count = Math.min(Math.max(input.count, 1), 12);
  const apiKey = process.env["GEMINI_API_KEY"];

  let reviews: GeneratedReview[] = [];

  if (apiKey) {
    try {
      const prompt = `You write short, believable customer reviews for a digital-asset store.
Product: "${input.productTitle}".
Context from the seller: ${input.description}

Return ONLY valid JSON: an array of ${count} objects with keys "name", "handle", "rating", "body".
- name: realistic first + last name, mix Indian and international names
- handle: an @username matching the person, lowercase, no spaces
- rating: integer 4 or 5 (make roughly 1 in 5 a 4)
- body: 1-2 sentences, 12-30 words, specific about editing workflow, no emojis, no marketing tone`;

      // Try gemini-2.5-flash first, then gemini-1.5-flash
      const models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-flash-latest"];
      let success = false;

      for (const model of models) {
        if (success) break;
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
              }),
            },
          );

          if (response.ok) {
            const payload = (await response.json()) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
            const parsed = JSON.parse(text) as GeneratedReview[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              reviews = parsed.slice(0, count).map((r) => ({
                name: String(r.name ?? "Anonymous"),
                handle: String(r.handle ?? "").replace(/^@?/, "@"),
                rating: Math.min(5, Math.max(1, Number(r.rating ?? 5))),
                body: String(r.body ?? ""),
              }));
              success = true;
            }
          }
        } catch {
          // Try next model
        }
      }
    } catch (err) {
      console.warn("AI review generation via API failed, using smart fallback:", err);
    }
  }

  if (reviews.length === 0) {
    reviews = generateSmartFallback(input.productTitle, input.description, count);
  }

  if (input.save && reviews.length > 0) {
    try {
      const db = adminClient();
      await db.from("reviews").insert(reviews.map((r) => ({ ...r, product_id: input.productId })));
    } catch (err) {
      console.warn("Failed to persist generated reviews to database:", err);
    }
  }

  return reviews;
}
