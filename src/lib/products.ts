import coverAe from "@/assets/cover-ae.jpg";
import coverLuts from "@/assets/cover-luts.jpg";
import coverExtension from "@/assets/cover-extension.jpg";
import coverSfx from "@/assets/cover-sfx.jpg";

export type Category = "After Effects" | "LUTs" | "Extensions" | "SFX Packs";

export type Review = {
  name: string;
  handle: string;
  rating: number;
  body: string;
  date: string;
};

export type Product = {
  slug: string;
  title: string;
  tagline: string;
  category: Category;
  cover: string;
  /** Optional preview video. Only rendered below the product details on the product page. */
  videoUrl?: string;
  isFree?: boolean;
  price: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
  sales: number;
  badge?: string;
  fileInfo: string[];
  description: string;
  features: string[];
  howToUse: { step: string; detail: string }[];
  reviews: Review[];
};

const inr = (n: number) => n;

export const products: Product[] = [
  {
    slug: "aurora-motion-pack",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    title: "Aurora Motion Pack",
    tagline: "120 cinematic After Effects transitions & titles",
    category: "After Effects",
    cover: coverAe,
    price: inr(1499),
    originalPrice: inr(3999),
    rating: 4.9,
    reviewCount: 218,
    sales: 3120,
    badge: "Bestseller",
    fileInfo: ["After Effects CC 2020+", "4K / 60fps", "2.8 GB", "No plugins"],
    description:
      "Aurora is a fully modular motion system built for editors who ship fast. Every transition, title and overlay is pre-composed with a single control layer, so you can restyle an entire sequence in seconds without touching keyframes.",
    features: [
      "120 drag-and-drop transitions",
      "48 animated title scenes",
      "One-click color control rig",
      "Lifetime free updates",
    ],
    howToUse: [
      { step: "Download & unzip", detail: "Extract the pack anywhere on your drive — no installer needed." },
      { step: "Open the master project", detail: "Launch Aurora_Master.aep in After Effects CC 2020 or newer." },
      { step: "Drag a preset in", detail: "Pull any composition onto your timeline and it snaps to your footage." },
      { step: "Restyle instantly", detail: "Use the Control layer to change color, speed and grain globally." },
    ],
    reviews: [
      {
        name: "Aarav Mehta",
        handle: "@aaravcuts",
        rating: 5,
        body: "Cut my edit time in half. The control rig alone is worth the price.",
        date: "2 weeks ago",
      },
      {
        name: "Lena Fischer",
        handle: "@lenagrade",
        rating: 5,
        body: "Cleanest AE pack I have bought. Renders fast and nothing breaks.",
        date: "1 month ago",
      },
      {
        name: "Diego Ruiz",
        handle: "@diegomotion",
        rating: 4,
        body: "Great value. Would love a few more vertical presets for reels.",
        date: "1 month ago",
      },
    ],
  },
  {
    slug: "halcyon-lut-collection",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    title: "Halcyon LUT Collection",
    tagline: "60 film-emulation LUTs graded on real scans",
    category: "LUTs",
    cover: coverLuts,
    price: inr(899),
    originalPrice: inr(2499),
    rating: 4.8,
    reviewCount: 164,
    sales: 2410,
    badge: "New drop",
    fileInfo: [".cube 33pt", "Rec.709 + Log", "180 MB", "Works everywhere"],
    description:
      "Halcyon is built from scanned film stocks and hand-balanced for digital sensors. Each LUT ships in Rec.709 and Log variants so your grade holds up whether you shoot on a phone or a cinema camera.",
    features: [
      "60 LUTs in .cube format",
      "Rec.709 and Log variants",
      "Premiere, DaVinci, FCP, AE ready",
      "Skin-tone safe roll-off",
    ],
    howToUse: [
      { step: "Pick your variant", detail: "Use the Log folder for flat footage, Rec.709 for standard profiles." },
      { step: "Load into your NLE", detail: "Apply as a Lumetri / Color Space Transform LUT on an adjustment layer." },
      { step: "Balance first", detail: "Set exposure and white balance before the LUT for the cleanest result." },
      { step: "Dial the intensity", detail: "Drop opacity to 60–80% for a subtle, premium look." },
    ],
    reviews: [
      {
        name: "Priya Nair",
        handle: "@priyashoots",
        rating: 5,
        body: "Skin tones stay perfect. These are not the usual orange-teal presets.",
        date: "5 days ago",
      },
      {
        name: "Marcus Hale",
        handle: "@halefilms",
        rating: 5,
        body: "Used the Log set on a client doc and delivered same day. Superb.",
        date: "3 weeks ago",
      },
    ],
  },
  {
    slug: "flowdeck-extension",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    title: "Flowdeck Extension",
    tagline: "A control deck panel for Premiere & After Effects",
    category: "Extensions",
    cover: coverExtension,
    price: inr(1999),
    originalPrice: inr(4999),
    rating: 4.9,
    reviewCount: 96,
    sales: 1180,
    fileInfo: ["CEP extension", "Win + macOS", "40 MB", "Auto-updates"],
    description:
      "Flowdeck puts your whole workflow into one floating panel: batch renames, proxy generation, preset libraries and instant exports. It docks anywhere and remembers your layout per project.",
    features: [
      "Batch rename & organise",
      "One-click proxy pipeline",
      "Searchable preset library",
      "Free updates for 12 months",
    ],
    howToUse: [
      { step: "Run the installer", detail: "Pick the installer for macOS or Windows and follow the prompts." },
      { step: "Restart your host app", detail: "Flowdeck appears under Window → Extensions." },
      { step: "Dock the panel", detail: "Drag it beside your Effect Controls for the fastest workflow." },
      { step: "Sync your presets", detail: "Point Flowdeck at any folder to index it into the library." },
    ],
    reviews: [
      {
        name: "Tanvi Shah",
        handle: "@tanviedits",
        rating: 5,
        body: "The proxy pipeline saved my 4K wedding project. Instant buy.",
        date: "1 week ago",
      },
      {
        name: "Yusuf Demir",
        handle: "@yusufpost",
        rating: 5,
        body: "Feels like a native Adobe panel. Very polished.",
        date: "2 months ago",
      },
    ],
  },
  {
    slug: "signal-sfx-pack",
    title: "Signal SFX Pack",
    tagline: "800 designed sound effects for modern edits",
    category: "SFX Packs",
    cover: coverSfx,
    price: inr(1199),
    originalPrice: inr(2999),
    rating: 4.7,
    reviewCount: 132,
    sales: 1960,
    badge: "Editor favourite",
    fileInfo: ["WAV 48kHz/24-bit", "800 files", "1.4 GB", "Royalty free"],
    description:
      "Signal is a designed sound library — whooshes, risers, UI clicks, impacts and textures — all loudness matched and tagged so you can drop them straight onto a timeline without EQ work.",
    features: [
      "800 royalty-free WAV files",
      "Loudness matched at -16 LUFS",
      "Tagged and folder-sorted",
      "Commercial licence included",
    ],
    howToUse: [
      { step: "Unzip the library", detail: "Keep the folder structure so tags stay searchable." },
      { step: "Index in your NLE", detail: "Add the folder to your media browser or Soundly library." },
      { step: "Search by intent", detail: "Filenames use plain words like riser, click, impact, texture." },
      { step: "Layer for depth", detail: "Stack a texture under any impact for a cinematic finish." },
    ],
    reviews: [
      {
        name: "Rohan Gupta",
        handle: "@rohansound",
        rating: 5,
        body: "Loudness matching is the detail nobody else gets right. Love it.",
        date: "4 days ago",
      },
      {
        name: "Amelie Roux",
        handle: "@amelieedits",
        rating: 4,
        body: "Huge library, great quality. Wish there were more sub drops.",
        date: "3 weeks ago",
      },
    ],
  },
];

export const categories: Category[] = ["After Effects", "LUTs", "Extensions", "SFX Packs"];

export function getProduct(slug: string) {
  return products.find((p) => p.slug === slug);
}

export function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}
