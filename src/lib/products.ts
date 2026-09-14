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

// Preview clips for the offline fallback catalogue. These point at the same
// self-hosted MP4s the landing page uses (public/media) rather than a third-party
// sample bucket, so the fallback works with nothing but this repository.
const PREVIEW_AE = "/media/solution.mp4";
const PREVIEW_LUTS = "/media/mission.mp4";
const PREVIEW_EXTENSION = "/media/hero.mp4";

export const products: Product[] = [
  {
    slug: "deepcomp-make-after-effects-feel-unfairly-easy",
    videoUrl: PREVIEW_AE,
    title: "DeepComp — Make After Effects Feel Unfairly Easy",
    tagline:
      "The fastest multi-layer composition toolkit & automation preset engine for After Effects",
    category: "After Effects",
    cover: coverAe,
    price: inr(299),
    originalPrice: inr(999),
    rating: 4.9,
    reviewCount: 142,
    sales: 1840,
    badge: "Bestseller",
    fileInfo: ["After Effects CC 2020+", "4K / 60fps", "1.2 GB", "Universal Expressions"],
    description:
      "DeepComp transforms complex timeline workflows into single-click actions. Pre-built with intelligent motion curves, auto-retime logic, and procedural title and framing rigs.",
    features: [
      "Modular compositing control rig",
      "Dynamic typography & title presets",
      "Instant easing & kinetic motion scripts",
      "Lifetime updates and priority support",
    ],
    howToUse: [
      {
        step: "Install DeepComp preset file",
        detail:
          "Copy to your After Effects User Presets directory or open the project file directly.",
      },
      {
        step: "Apply with 1-click",
        detail: "Highlight your layer and apply DeepComp from the Effects & Presets panel.",
      },
      {
        step: "Adjust master controls",
        detail: "Use the Master Rig sliders in Effect Controls to tweak dynamics in real-time.",
      },
    ],
    reviews: [
      {
        name: "Vikram R.",
        handle: "@vikram_edit",
        rating: 5,
        body: "DeepComp is literally an unfair advantage for client edits. 10/10 recommend.",
        date: "3 days ago",
      },
      {
        name: "Sara K.",
        handle: "@saravfx",
        rating: 5,
        body: "Super fast, clean keyframe architecture and zero plugin dependencies.",
        date: "2 weeks ago",
      },
    ],
  },
  {
    slug: "the-ultimate-2000-sfx-pack",
    videoUrl: undefined,
    title: "The Ultimate 2000+ Sfx pack",
    tagline:
      "Massive library of 2000+ cinema-grade sound effects, whooshes, risers, hits & textures",
    category: "SFX Packs",
    cover: coverSfx,
    price: inr(1299),
    originalPrice: inr(3999),
    rating: 4.9,
    reviewCount: 260,
    sales: 3420,
    badge: "Popular",
    fileInfo: ["WAV 48kHz / 24-bit", "2,000+ files", "3.4 GB", "100% Royalty Free"],
    description:
      "The definitive sound design vault for content creators, commercial editors, and film makers. Mastered at broadcast standards (-16 LUFS) with extensive Soundminer metadata tagging.",
    features: [
      "2,000+ master WAV audio files",
      "Categorized into Whooshes, Risers, Impacts, UI & Ambience",
      "Pristine 24-bit/48kHz studio audio fidelity",
      "Commercial license for YouTube, TV & streaming",
    ],
    howToUse: [
      {
        step: "Extract audio folders",
        detail: "Unzip the archive to your internal or external sound library drive.",
      },
      {
        step: "Import to your NLE",
        detail: "Drag into Premiere Pro, DaVinci Resolve, Final Cut, or After Effects.",
      },
      {
        step: "Search by keyword",
        detail:
          "Search tags like 'deep riser', 'glitch whoosh', or 'heavy slam' to instantly find sounds.",
      },
    ],
    reviews: [
      {
        name: "Karan D.",
        handle: "@soundbykaran",
        rating: 5,
        body: "The variety and low-end punch in this SFX bundle is unmatched.",
        date: "1 week ago",
      },
    ],
  },
  {
    slug: "realestae-text-project-file-text-effect-animation",
    videoUrl: PREVIEW_AE,
    title: "Realestae Text Project FIle, Text Effect+Animation",
    tagline: "Clean, high-converting architectural typography & text animation hierarchy",
    category: "After Effects",
    cover: coverAe,
    price: inr(119),
    originalPrice: inr(499),
    rating: 4.8,
    reviewCount: 76,
    sales: 980,
    badge: "Trending",
    fileInfo: ["After Effects CC 2020+", "Full HD & 4K", "150 MB", "Custom Fonts Included"],
    description:
      "Designed specifically for luxury real estate promos, property showcases, and corporate video intros. Elegant typography animations that elevate property listings instantly.",
    features: [
      "Pre-animated luxury headline treatments",
      "Price tag & amenity badge animations",
      "Modular lower-thirds and specs cards",
      "Fully customizable colors and font scaling",
    ],
    howToUse: [
      {
        step: "Open project in After Effects",
        detail: "Open the .aep file and find the 'Edit Your Text Here' folder.",
      },
      {
        step: "Replace property text",
        detail: "Type your address, square footage, and pricing details.",
      },
      {
        step: "Export or dynamic link",
        detail: "Render directly or drag into Premiere Pro via Adobe Dynamic Link.",
      },
    ],
    reviews: [
      {
        name: "Arjun S.",
        handle: "@arjundesigns",
        rating: 5,
        body: "Made my property reels look 10x more high end. Easy to customize.",
        date: "5 days ago",
      },
    ],
  },
  {
    slug: "impact-shake-preset",
    videoUrl: PREVIEW_AE,
    title: "Impact Shake Preset",
    tagline: "Heavy impact, bass drop, and camera vibration presets for punchy transitions",
    category: "After Effects",
    cover: coverAe,
    price: inr(19),
    originalPrice: inr(199),
    rating: 4.8,
    reviewCount: 190,
    sales: 2150,
    badge: "Hot Deal",
    fileInfo: [
      "After Effects Preset (.ffx)",
      "Zero Plugins",
      "Instant Download",
      "All Resolutions",
    ],
    description:
      "Engineered realistic camera inertia and high-frequency twitch shakes. Perfect for trailer cuts, action edits, beat drops, and transition accents.",
    features: [
      "12 customized shake intensity variations",
      "Motion blur enabled presets",
      "Drag & drop onto adjustment layers",
      "Works in any composition frame rate (24, 30, 60 fps)",
    ],
    howToUse: [
      {
        step: "Drag onto adjustment layer",
        detail: "Cut an adjustment layer over your beat drop or cut point.",
      },
      {
        step: "Apply preset",
        detail: "Drop the .ffx preset onto the adjustment layer.",
      },
    ],
    reviews: [
      {
        name: "Dev M.",
        handle: "@devedits",
        rating: 5,
        body: "Best ₹19 I ever spent. Saves tons of time keyframing wiggle expressions.",
        date: "Yesterday",
      },
    ],
  },
  {
    slug: "premium-money-rain-overlay",
    videoUrl: PREVIEW_LUTS,
    title: 'Premium "MONEY RAIN" Overlay',
    tagline: "Cinematic 4K looping money rain visual overlays with alpha transparency",
    category: "After Effects",
    cover: coverLuts,
    isFree: true,
    price: inr(0),
    originalPrice: inr(999),
    rating: 4.9,
    reviewCount: 310,
    sales: 4200,
    badge: "Free Pack",
    fileInfo: ["ProRes 4444 / PNG Alpha", "4K UHD 60fps", "650 MB", "Looping Seamless"],
    description:
      "Crisp, physically accurate falling currency notes and bills rendered with depth-of-field and realistic motion blur. Drag directly over your footage with zero green-screen keying required.",
    features: [
      "Transparent alpha channel video loops",
      "Multiple camera angles and currency densities",
      "Compatible with Premiere, FCP, DaVinci, AE, CapCut",
      "100% Free instant download",
    ],
    howToUse: [
      {
        step: "Download free pack",
        detail: "Claim the pack for free and receive the direct download link.",
      },
      {
        step: "Overlay footage",
        detail: "Drag the ProRes clip above your video track in your timeline.",
      },
    ],
    reviews: [
      {
        name: "Nikhil P.",
        handle: "@nikhil_reels",
        rating: 5,
        body: "Insane quality for a free pack! Alpha transparency worked seamlessly.",
        date: "1 week ago",
      },
    ],
  },
  {
    slug: "free-colour-bounce-text-animation",
    videoUrl: PREVIEW_AE,
    title: "Free Colour Bounce Text Animation",
    tagline: "Playful bouncing text style preset with automatic in & out kinetic easing",
    category: "After Effects",
    cover: coverAe,
    isFree: true,
    price: inr(0),
    originalPrice: inr(499),
    rating: 4.9,
    reviewCount: 245,
    sales: 3800,
    badge: "Free Pack",
    fileInfo: ["After Effects .aep & .ffx", "Vector Scalable", "100% Native", "Commercial OK"],
    description:
      "Vibrant, bouncy character-by-character color shifting text animations. Perfect for YouTube videos, kinetic typography explainers, and Instagram reels.",
    features: [
      "Customizable bounce decay and elasticity",
      "Gradient color cycling controls",
      "Responsive in/out marker animation",
      "100% Free forever",
    ],
    howToUse: [
      {
        step: "Apply to text layer",
        detail: "Create any standard text layer and apply the Colour Bounce preset.",
      },
    ],
    reviews: [
      {
        name: "Ananya T.",
        handle: "@ananyacreates",
        rating: 5,
        body: "Super cute and smooth animation. Thank you for making this free!",
        date: "2 weeks ago",
      },
    ],
  },
  {
    slug: "animated-character-pack-cool-motion-design",
    videoUrl: PREVIEW_EXTENSION,
    title: "Animated Character Pack then Mkae your Blank Frame A Cool Motion design",
    tagline: "Full rigged vector character animations for explainer & reel edits",
    category: "After Effects",
    cover: coverExtension,
    isFree: true,
    price: inr(0),
    originalPrice: inr(1499),
    rating: 5.0,
    reviewCount: 420,
    sales: 5120,
    badge: "Free Pack",
    fileInfo: ["After Effects CC 2021+", "Vector AI Rig", "500 MB", "Looping Poses"],
    description:
      "Give your blank canvas dynamic life with pre-rigged, modular character animations. Includes walking, pointing, holding phones, typing, and celebratory motion loops.",
    features: [
      "Over 30 distinct rigged poses and loop cycles",
      "One-click skin tone and outfit color palette switchers",
      "Smooth vector scalability to 8K resolution",
      "100% Free instant download",
    ],
    howToUse: [
      {
        step: "Import Character Rig",
        detail: "Open the Character Master composition and pick your desired character pose.",
      },
      {
        step: "Drag to scene",
        detail: "Nest the character composition directly into your background scene.",
      },
    ],
    reviews: [
      {
        name: "Rahul G.",
        handle: "@rahulmotion",
        rating: 5,
        body: "Huge time saver for client explainer videos. Rigging is super clean!",
        date: "3 days ago",
      },
    ],
  },
  {
    slug: "aurora-motion-pack",
    videoUrl: PREVIEW_AE,
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
      {
        step: "Download & unzip",
        detail: "Extract the pack anywhere on your drive — no installer needed.",
      },
      {
        step: "Open the master project",
        detail: "Launch Aurora_Master.aep in After Effects CC 2020 or newer.",
      },
      {
        step: "Drag a preset in",
        detail: "Pull any composition onto your timeline and it snaps to your footage.",
      },
      {
        step: "Restyle instantly",
        detail: "Use the Control layer to change color, speed and grain globally.",
      },
    ],
    reviews: [
      {
        name: "Aarav Mehta",
        handle: "@aaravcuts",
        rating: 5,
        body: "Cut my edit time in half. The control rig alone is worth the price.",
        date: "2 weeks ago",
      },
    ],
  },
  {
    slug: "halcyon-lut-collection",
    videoUrl: PREVIEW_LUTS,
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
      {
        step: "Pick your variant",
        detail: "Use the Log folder for flat footage, Rec.709 for standard profiles.",
      },
      {
        step: "Load into your NLE",
        detail: "Apply as a Lumetri / Color Space Transform LUT on an adjustment layer.",
      },
    ],
    reviews: [
      {
        name: "Priya Nair",
        handle: "@priyashoots",
        rating: 5,
        body: "Skin tones stay perfect. These are not the usual orange-teal presets.",
        date: "5 days ago",
      },
    ],
  },
  {
    slug: "flowdeck-extension",
    videoUrl: PREVIEW_EXTENSION,
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
      {
        step: "Run the installer",
        detail: "Pick the installer for macOS or Windows and follow the prompts.",
      },
    ],
    reviews: [
      {
        name: "Tanvi Shah",
        handle: "@tanviedits",
        rating: 5,
        body: "The proxy pipeline saved my 4K wedding project. Instant buy.",
        date: "1 week ago",
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
