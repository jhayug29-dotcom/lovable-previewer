export type Category = "After Effects" | "LUTs" | "Extensions" | "SFX Packs";

export type Review = {
  name: string;
  handle: string;
  rating: number;
  body: string;
  date: string;
};

export type Product = {
  id?: string;
  slug: string;
  title: string;
  tagline: string;
  category: Category;
  cover: string;
  banner?: string;
  /** Optional preview video. Only rendered below the product details on the product page. */
  videoUrl?: string;
  downloadLink?: string;
  isFree?: boolean;
  price: number;
  originalPrice: number;
  rating: number;
  reviewCount: number;
  sales: number;
  badge?: string;
  showOnHomepage?: boolean;
  launchTime?: string | null;
  timerImageUrl?: string | null;
  fileInfo: string[];
  description: string;
  features: string[];
  howToUse: { step: string; detail: string }[];
  reviews: Review[];
};

export const categories: Category[] = ["After Effects", "SFX Packs", "LUTs", "Extensions"];

export function formatPrice(value: number): string {
  if (value === 0) return "Free";
  return `₹${value.toLocaleString("en-IN")}`;
}

/**
 * Baseline products catalog matching the live Supabase database exactly.
 * When the repository is cloned, pushed to GitHub, or deployed without a local .env file,
 * this ensures that no data, images, descriptions, or download links are lost.
 */
export const products: Product[] = [
  {
    id: "3756b26e-9a3e-4fad-8dd0-2aa3a363e799",
    slug: "Ae Extention",
    title: "DeepComp — Make After Effects Feel Unfairly Easy",
    tagline:
      "Built to kill repetitive work, speed up your workflow, and make After Effects feel ridiculously easy",
    category: "After Effects",
    cover:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1789299104960-klmveqzc8pk.jpg",
    banner:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1789299108398-sak45pcipf8.jpg",
    downloadLink:
      "https://drive.google.com/file/d/1aOVfpZ1zN34qus680I4Vv5L1NuIP_0x8/view?usp=sharing",
    isFree: false,
    price: 299,
    originalPrice: 1199,
    rating: 5,
    reviewCount: 0,
    sales: 0,
    badge: "Hot",
    showOnHomepage: true,
    launchTime: null,
    timerImageUrl: null,
    fileInfo: ["Zip File"],
    description:
      "# DeepComp — Your After Effects Workflow, Upgraded.\n\n**DeepComp is an all-in-one After Effects workflow panel built to help editors animate faster, stay organized, and eliminate repetitive work.** From text animations and effects to precomps, SFX, expressions, and essential workflow utilities — everything you need is packed into one clean, fast panel.\n\n| ⚡ TEXT ANIMATION                                                                                                                                                               | 🎨 EFFECTS & ANIMATION                                                                                                                                         |\n| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| Create eye-catching text animations in seconds with ready-to-use styles like **Word Stack, Bounce, Wobble, Blur by Word, Color Reveal, Word Ramp, Polished Up/Down** and more. | Speed up your animation workflow with powerful effects and animation tools including **Bounce, Metallic Text, Color Wheel, Wobble, Rounded Corners** and more. |\n\n| 🛠️ TOOLKIT                                                                                                                                                        | 🎵 SFX LIBRARY                                                                                                           |\n| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |\n| Handle everyday AE tasks faster with tools for **Nulls, Solids, Cameras, Duplicate, Trim, Sequence, Precompose, Unprecompose, Align, Project Organizer** and more. | Quickly browse and use your **SFX collection** directly inside After Effects without constantly digging through folders. |\n\n| 📦 PRECOMP LIBRARY                                                                                                      | 💾 SAVE PRECOMPS                                                                                                         |\n| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |\n| Keep your most-used precomps organized and ready to reuse across projects, making your workflow cleaner and way faster. | Save selected precomps directly from your timeline and build your own reusable **Precomp Library** with visual previews. |\n\n| 🧠 EXPRESSION LIBRARY                                                                       | ⏩ LAYER OFFSET                                                                                                    |\n| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |\n| Store and reuse useful **expressions** without repeatedly searching for or rebuilding them. | Offset selected layers instantly with dedicated **1, 5, and 10-frame controls** for faster timing and sequencing. |\n\n| 🎬 STORYBOARD                                                                                                                                              | 🎨 FIGMA → AFTER EFFECTS                                                                                                                             |\n| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |\n| Plan your animations visually with a **Figma-inspired storyboard workspace** where you can arrange ideas, assets, and scenes before bringing them to life. | Transfer your Figma designs into After Effects with the **DeepComp Figma workflow**, making it easier to continue designing and animating inside AE. |\n\n### ✦ Built For Editors Who Move Fast\n\n**Less setup. Less repetitive clicking. More creating.**\n\nDeepComp is designed around the things editors do every single day — so instead of jumping between menus, scripts, folders, and windows, you can keep your workflow in one place and get straight back to creating.\n\n**From a simple text animation to a full motion-design workflow — DeepComp keeps everything just a click away.**\n\n",
    features: [
      "⚡ Text Animation",
      "Word Stack",
      "Jump",
      "Smooth Up",
      "Polished Down",
      "Bounce Down",
      "Bounce Up",
      "Wobble",
      "Blur by Word",
      "Polished Up",
      "Color Reveal",
      "Word Ramp",
      "🎨 Effects & Animation",
      "Metallic Text",
      "Color Wheel",
      "Bounce",
      "Wobble",
      "Rounded Corners",
      "CC Light Sweep",
      "🛠️ Toolkit",
      "Nulls",
      "Solids",
      "Cameras",
      "Duplicate",
      "Trim In/Out",
      "Sequence Layers",
      "Precompose",
      "Unprecompose",
      "Align",
      "Project Organizer",
      "Layer Offset",
      "📦 Libraries",
      "SFX Library",
      "Precomp Library",
      "Expression Library",
      "💾 Save Precomp",
      "Save Precomp",
      "Precomp Preview",
      "Precomp Library Import",
      "🎬 Storyboard",
      "New Project",
      "Storyboard Canvas",
      "Drag & Drop Assets",
      "Layer Management",
      "Delete Layers",
      "Figma-style Workspace",
      "🎨 Figma → AE",
      "Figma Import",
      "Send Selection to AE",
      "Layer Import",
      "Editable Text",
      "Editable Shapes",
      "Groups",
      "Images",
      "Effects",
      "⚙️ Workflow Utilities",
      "Animation Tools",
      "Effect Tools",
      "Layer Controls",
      "Timing Controls",
      "Precomp Tools",
      "Project Organization",
    ],
    howToUse: [
      {
        step: "# How to Install DeepComp",
        detail: "",
      },
      {
        step: "## After Effects",
        detail: "",
      },
      {
        step: "**1. Download DeepComp**",
        detail: "",
      },
      {
        step: "Download the DeepComp installer/package for your system.",
        detail: "",
      },
      {
        step: "**2. Run the Installer**",
        detail: "",
      },
      {
        step: "Open the installer and follow the setup steps.",
        detail: "",
      },
      {
        step: "**3. Install the Panel**",
        detail: "",
      },
      {
        step: "Make sure the After Effects extension/panel option is selected during installation.",
        detail: "",
      },
      {
        step: "**4. Restart After Effects**",
        detail: "",
      },
      {
        step: "Close and reopen After Effects after the installation is complete.",
        detail: "",
      },
      {
        step: "**5. Open DeepComp**",
        detail: "",
      },
      {
        step: "Go to **Window → Extensions → DeepComp** and launch the panel.",
        detail: "",
      },
      {
        step: "---",
        detail: "",
      },
      {
        step: "## Figma Plugin",
        detail: "",
      },
      {
        step: "**1. Open Figma**",
        detail: "",
      },
      {
        step: "Launch Figma and open any design file.",
        detail: "",
      },
      {
        step: "**2. Install DeepComp Plugin**",
        detail: "",
      },
      {
        step: "Import/install the **DeepComp Figma Plugin** from the provided plugin file.",
        detail: "",
      },
      {
        step: "**3. Run the Plugin**",
        detail: "",
      },
      {
        step: "Open your Figma file and launch **DeepComp → Send Selection to AE**.",
        detail: "",
      },
      {
        step: "**4. Connect to After Effects**",
        detail: "",
      },
      {
        step: "Keep After Effects and the DeepComp panel open while using the Figma plugin.",
        detail: "",
      },
      {
        step: "**5. Send Your Design**",
        detail: "",
      },
      {
        step: "Select your Figma frame or elements → click **Send Selection to AE** → your design is transferred to After Effects.",
        detail: "",
      },
      {
        step: "### You're all set. ⚡",
        detail: "",
      },
      {
        step: "**DeepComp + After Effects + Figma = One connected workflow.**",
        detail: "",
      },
    ],
    reviews: [],
  },
  {
    id: "15f2c707-7cc8-4c05-9ed9-70ff1e7ea315",
    slug: "Animated Character Pack",
    title: "Animated Character Pack that Make your Blank Frame A Cool Motion design",
    tagline: "30+ Animated Character Pack",
    category: "After Effects",
    cover:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1788369194697-h1rpsbvqmw.png",
    banner:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1788369200033-w0ifvcww8yl.png",
    downloadLink:
      "https://drive.google.com/drive/folders/1ooXX2MBgqxWzEu0ovEeIqHqbOYPNiRP7?usp=sharing",
    isFree: true,
    price: 0,
    originalPrice: 0,
    rating: 5,
    reviewCount: 0,
    sales: 0,
    badge: "Free",
    showOnHomepage: true,
    launchTime: null,
    timerImageUrl: null,
    fileInfo: ["30+ Animated Character Pack"],
    description:
      "# 30+ Animated Characters Pack\n\nBring your videos, animations, reels, presentations, and motion graphics to life with this **30+ Animated Characters Pack** — a versatile collection of professionally designed animated characters created to make your content more dynamic, expressive, and engaging.\n\nWhether you're working on **YouTube videos, explainer videos, social media content, advertisements, educational videos, storytelling projects, presentations, or motion graphics**, these animated characters give you an easy way to add personality and visual storytelling to your edits without having to create every character from scratch.\n\n### 🎭 30+ Ready-to-Use Characters\n\nGet access to a diverse collection of **30+ animated characters**, giving you plenty of options for different scenes, stories, and creative concepts. Use different characters to represent people, situations, emotions, reactions, actions, and everyday scenarios.\n\nInstead of repeatedly searching for character animations or spending hours building them yourself, you can simply choose the character that fits your scene and integrate it into your project.\n\n### ⚡ Designed for Faster Editing\n\nThis pack is built with editors and content creators in mind. The characters are designed to help you **speed up your workflow** while maintaining a polished visual style.\n\nSimply place the character into your composition, position it where you need it, and build your scene around it. They can be combined with text, icons, backgrounds, transitions, shapes, and other motion elements to create complete animated sequences.\n\n### 🎬 Perfect for Multiple Types of Content\n\nThese characters can be used across a wide range of projects, including:\n\n* YouTube videos & Shorts\n* Explainer videos\n* Educational content\n* Social media reels\n* Advertisements\n* Product videos\n* Business presentations\n* Storytelling animations\n* Motion graphics\n* Marketing videos\n* UI/UX presentations\n* VSLs and promotional content\n\nWhether you're explaining an idea, showing a customer journey, creating a funny moment, or visually representing a concept, animated characters can make your content much easier to understand and more visually interesting.\n\n### 🧩 Mix, Match & Create\n\nThe real power of the pack comes from how creatively you can use it. Combine multiple characters in the same scene, layer them with your existing assets, change their placement, and create completely different scenarios from the same collection.\n\nYou can use one character for a simple reaction or build an entire animated sequence using multiple characters.\n\n### 🚀 Save Hours of Work\n\nCreating animated characters from scratch can take a significant amount of time — especially when you're working with tight deadlines. This pack gives you a ready-made character library so you can focus more on **editing, storytelling, and creativity** instead of repetitive animation work.\n\nIt's especially useful for editors who regularly create content and need visual assets that can be quickly reused across different projects.\n\n### ✨ Made for Creators\n\nWhether you're a **video editor, motion designer, YouTuber, freelancer, marketer, or content creator**, this character pack can become a valuable addition to your digital asset library.\n\nAdd personality to your scenes. Make explanations more visual. Improve storytelling. And most importantly, **create faster without starting from zero every time.**\n\n**30+ animated characters. Endless creative possibilities. One pack built to make your workflow faster and your videos more engaging.**\n",
    features: ["You can use this to turn your simple frame into a cool motion design."],
    howToUse: [
      {
        step: "Drag and Drop Onto your timeline",
        detail: "",
      },
    ],
    reviews: [],
  },
  {
    id: "80ed0bfc-0d3f-472d-98cd-35256feacd12",
    slug: "Text Animation",
    title: "Free Colour Bounce Text Animation",
    tagline: "A color-bounce text animation created by me.",
    category: "After Effects",
    cover:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786770269783-rauuxelw32r.jpg",
    banner:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786770277319-aqvfw66g12c.jpg",
    downloadLink:
      "https://drive.google.com/drive/folders/1tUIY62FQG3kBDhWoU-dE_5-rOjHZvaF0?usp=sharing",
    isFree: true,
    price: 0,
    originalPrice: 0,
    rating: 5,
    reviewCount: 0,
    sales: 0,
    badge: "Free",
    showOnHomepage: true,
    launchTime: null,
    timerImageUrl: null,
    fileInfo: ["After Effects Preset File Just Import and Use"],
    description:
      "Introducing the Color Bounce Text Animation Preset — a fresh, eye-catching, and completely unique Adobe After Effects preset created by me from scratch. This preset combines smooth bouncing motion with dynamic color changes to give your text a bold, energetic, and premium animated look. Every movement is designed to feel satisfying, fluid, and visually engaging, making it perfect for reels, social media edits, promos, ads, YouTube videos, motion graphics, and creative content.\n\nThis isn’t just another basic bounce animation. The combination of colorful transitions, timing, motion, and bounce creates a distinctive effect that stands out instantly. I personally designed and animated this preset with creativity and attention to detail, giving you a look that feels fresh and different from typical text animations. Simply apply it to your text and transform ordinary typography into an attention-grabbing animation within seconds. Fast, unique, powerful, and made for creators who want their edits to stand out.",
    features: ["Unique Crazy Text Animation That Make your Video Instantly Expensive"],
    howToUse: [
      {
        step: "Download and pase Into your user preset folder",
        detail: "",
      },
    ],
    reviews: [],
  },
  {
    id: "957f33cf-bd1c-459c-9158-cbd7ec2d4b29",
    slug: "Realestate Text",
    title: "Realestae Text Project FIle, Text Effect+Animation",
    tagline: "Trending Realestate Text Animation and Text Effect Project File",
    category: "After Effects",
    cover:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786767493281-a3zi3l50ji.jpg",
    banner:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786767497424-qwlynph3e3j.jpg",
    downloadLink:
      "https://drive.google.com/drive/folders/1D_Jqc16kn_60Cqcr3iIJ8cdMp0eBSQN5?usp=sharing",
    isFree: false,
    price: 119,
    originalPrice: 599,
    rating: 5,
    reviewCount: 5,
    sales: 0,
    badge: "Trending",
    showOnHomepage: true,
    launchTime: null,
    timerImageUrl: null,
    fileInfo: ["Aep Project File After effect"],
    description:
      "Take your real estate edits to the next level with this premium After Effects project file, inspired by the modern, fast-paced Four Horsemen-style real estate editing aesthetic. This project focuses on clean typography, punchy text reveals, smooth transitions, dynamic scaling, and polished motion that keeps property videos engaging and professional.\n\nPerfect for showcasing property prices, locations, features, amenities, offers, and key selling points with a cinematic and high-retention feel. The animations are designed to blend naturally with real estate footage while adding energy without making the edit look cluttered.\n\nThe project is fully editable inside After Effects, allowing you to customize text, fonts, colors, timing, positioning, and animation properties according to your project. Whether you're creating Instagram Reels, YouTube Shorts, property ads, or luxury real estate promos, these animations can help give your videos a more premium and modern finish.\n\nBuilt for editors who want faster workflows and professional real estate motion graphics.",
    features: ["Trending Text Animation & Effect Like Fourhorsemedia"],
    howToUse: [
      {
        step: "You need to download everything, including the footage. This project file was created in the 2025 version of After Effects, so it won't work in older versions; you will need to downgrade it to your compatible version using a free AE downgrade website.",
        detail: "",
      },
    ],
    reviews: [
      {
        name: "Liam Parker",
        handle: "@liamparkervfx",
        rating: 5,
        body: "The typography presets saved me hours on client property reels. Keyframes are organized logically and easy to adapt in After Effects.",
        date: "15 Aug 2026",
      },
      {
        name: "Rohan Mehta",
        handle: "@rohanm_edits",
        rating: 5,
        body: "Clean lower thirds and price callouts that fit vertical real estate formats well. Customizing colors and fonts took only a few minutes.",
        date: "15 Aug 2026",
      },
      {
        name: "Chloe Bennett",
        handle: "@chloebvisuals",
        rating: 4,
        body: "Solid animation timing and clean layouts for luxury listings. Render times were slightly heavy on complex comps, but the overall design quality is great.",
        date: "15 Aug 2026",
      },
      {
        name: "Ananya Sharma",
        handle: "@ananyasharma_ae",
        rating: 5,
        body: "Very smooth kinetic text transitions for property tours. Project structure makes swapping spec callouts and addresses straightforward during fast-turnaround edits.",
        date: "15 Aug 2026",
      },
      {
        name: "Marcus Vance",
        handle: "@marcusvance",
        rating: 5,
        body: "The location reveal cards and feature callouts integrated seamlessly into my timeline. Significantly sped up my weekly workflow for local listing videos.",
        date: "15 Aug 2026",
      },
    ],
  },
  {
    id: "aa9eeb8b-9854-4896-a959-021636934413",
    slug: "Shake Preset",
    title: "Impact Shake Preset",
    tagline: "Premium Impact Shake That Instantly make your Videos Proffestional",
    category: "After Effects",
    cover:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786725820574-tvpys2jzzpn.jpg",
    banner:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786725826001-l8i2c6tjqy.jpg",
    downloadLink:
      "https://drive.google.com/file/d/1T3E1zRIpGUbNCVxbc5X1Cy9v_SXV6VfO/view?usp=sharing",
    isFree: false,
    price: 19,
    originalPrice: 299,
    rating: 5,
    reviewCount: 0,
    sales: 0,
    badge: "Demanding",
    showOnHomepage: true,
    launchTime: null,
    timerImageUrl: null,
    fileInfo: ["For this, Boris FX's Sapphire plugin will be required."],
    description:
      "### Premium Impact Shake Preset\n\nTake your After Effects edits to the next level with this premium Impact Shake Preset, designed to add powerful, cinematic energy to your footage with minimal effort. Perfect for impact moments, beat drops, transitions, action shots, text animations, VFX, gaming edits, reels, and high-energy social media content. The preset creates a dynamic combination of controlled movement, punchy camera shake, and smooth motion that makes every impact feel stronger and more satisfying. Simply apply the preset, adjust it to match your scene, and instantly achieve a professional motion-graphics look without manually building complex shake animations from scratch. **Sapphire is required** for this preset to work correctly, as the setup relies on Sapphire effects to achieve its signature polished shake and impact finish. For the best results, use it with high-quality footage and combine it with sound effects for an even more powerful impact. Built for editors who want faster workflows without compromising on visual quality.\n",
    features: ["Premium Impact Shake That Instantly make your Videos Proffestional"],
    howToUse: [
      {
        step: "Import This Prest file in Your User Preset folder and just Drang IN & OUT in your Project",
        detail: "",
      },
    ],
    reviews: [],
  },
  {
    id: "e8625a4e-0e51-4c60-b3bb-12bbc9a7b9ec",
    slug: "Money Overlay",
    title: 'Premium "MONEY RAIN" Overlay',
    tagline: "Trending Premium Money Rain Overlay 4k",
    category: "After Effects",
    cover:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786721575243-v15n39tz1en.jpg",
    banner:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1786721579357-4ass1ltnp9i.jpg",
    downloadLink:
      "https://drive.google.com/file/d/1Dp6ASju6k7Af4Zfo1domRTwFDwpvChDB/view?usp=sharing",
    isFree: true,
    price: 0,
    originalPrice: 0,
    rating: 5,
    reviewCount: 0,
    sales: 0,
    badge: "Free",
    showOnHomepage: true,
    launchTime: null,
    timerImageUrl: null,
    fileInfo: ["4K Without Background Overlay Video Ready to Use"],
    description:
      "A premium money-themed overlay designed to instantly elevate your edits with a luxurious, high-value aesthetic. Crafted for creators, editors, agencies, and businesses, this overlay adds cinematic financial energy without making the footage feel cluttered. Smooth animations, refined typography, realistic currency elements, subtle highlights, and polished transitions create a professional visual that grabs attention while maintaining a premium look. Perfect for showcasing revenue, sales, profits, investments, pricing, business growth, luxury lifestyles, financial achievements, and high-ticket offers. The overlay is designed to blend seamlessly into modern social media content, VSLs, advertisements, YouTube videos, and promotional edits. Whether you're highlighting a major earning milestone or simply adding an expensive visual touch to your storytelling, this asset helps make the moment feel more impactful. Drop it into your timeline, customize it to match your project, and instantly give your content a more sophisticated, attention-grabbing finish.",
    features: ["“Make every dollar look like a million.”"],
    howToUse: [
      {
        step: "Just Import and Use",
        detail: "",
      },
    ],
    reviews: [],
  },
  {
    id: "d677a9c4-3133-4794-820c-161f20895d7a",
    slug: "Sfx pack",
    title: "The Ultimate 2000+ Sfx pack",
    tagline: "One of Most Demanding SFX Pack!!",
    category: "SFX Packs",
    cover:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1785839298203-1h9ronxdrod.jpg",
    banner:
      "https://wylcbblegcyzunychqqa.supabase.co/storage/v1/object/public/product-media/uploads/1785839302894-h9u6g0grrme.jpg",
    downloadLink:
      "https://drive.google.com/drive/folders/1PZJZBR3nSBWrRkjr3vbgBgeCwvM-Ig6D?usp=sharing",
    isFree: false,
    price: 1299,
    originalPrice: 4000,
    rating: 5,
    reviewCount: 0,
    sales: 0,
    badge: "Most Demanding",
    showOnHomepage: true,
    launchTime: null,
    timerImageUrl: null,
    fileInfo: ["Its file size is 1.78 GB."],
    description:
      "# 🎧 **Ultimate 2000+ Sound Effects Pack**\n\n## **Everything You Need. One Powerful Library.**\n\nStop wasting hours searching for the perfect sound effect. The **Ultimate 2000+ Sound Effects Pack** brings together **2,000+ premium-quality SFX** in one organized collection, giving you instant access to the sounds you need for **YouTube videos, Reels, films, commercials, motion graphics, gaming edits, UI animations, social media content, and more.**\n\nWhether you're creating **cinematic edits**, **high-energy short-form videos**, **product commercials**, or **professional motion graphics**, this pack helps you edit **faster**, **smarter**, and **better**.\n\n---\n\n# ✨ **What's Inside?**\n\nYou'll get access to **2,000+ professionally organized sound effects**, including:\n\n* 🔹 **UI / UX Sounds**\n* 🔹 **Button Clicks**\n* 🔹 **Granular Textures**\n* 🔹 **Granular Combos**\n* 🔹 **Ambient Atmospheres**\n* 🔹 **Transitions**\n* 🔹 **Transform Effects**\n* 🔹 **Hard & Soft Impacts**\n* 🔹 **Countdown & List Sounds**\n* 🔹 **Realistic Foley**\n* 🔹 **Human Sounds**\n* 🔹 **Cartoon Effects**\n* 🔹 **Musical Transitions**\n* 🔹 **Keyboard Typing**\n* 🔹 **Power Up / Down Effects**\n* 🔹 **Whooshes**\n* 🔹 **Risers**\n* 🔹 **Hits**\n* 🔹 **Glitches**\n* 🔹 **And Hundreds of Additional Professional Sounds**\n\nEvery category contains **multiple variations**, allowing you to choose the perfect sound for every scene and editing style.\n\n---\n\n# 🚀 **Why This Pack Is Worth Buying**\n\nMost creators waste valuable time searching through countless websites just to find one sound effect.\n\nWith this pack, **everything is already organized in one place.**\n\nThat means you can:\n\n✔ **Edit faster**\n\n✔ **Find sounds instantly**\n\n✔ **Keep your workflow organized**\n\n✔ **Never reuse the same sounds repeatedly**\n\n✔ **Focus on creativity instead of searching**\n\nInstead of downloading random files from different sources, you'll have a **complete professional sound library** that's always ready whenever inspiration strikes.\n\n---\n\n# 🎬 **Make Every Video Feel 10× Better**\n\nGreat visuals grab attention.\n\n**Great sound keeps people watching.**\n\nThe right sound effects add:\n\n* **Energy**\n* **Impact**\n* **Depth**\n* **Emotion**\n* **Professional polish**\n* **Cinematic quality**\n* **Smoother transitions**\n* **Better storytelling**\n* **Higher viewer engagement**\n\nEven a simple edit can feel dramatically more premium with professional sound design. Whether it's a subtle button click, a powerful impact, or a cinematic transition, the right audio transforms the entire viewing experience.\n\n---\n\n# 💼 **Perfect For**\n\n* 🎥 Video Editors\n* 🎬 Filmmakers\n* 📱 Content Creators\n* ▶️ YouTubers\n* 🎮 Gaming Creators\n* 🎨 Motion Designers\n* 📢 Marketing Agencies\n* 💻 UI/UX Designers\n* 📈 Social Media Managers\n* 🚀 Freelancers\n\nWhether you're a beginner or an experienced professional, this collection is designed to fit seamlessly into your workflow.\n\n---\n\n# ⭐ **Why Creators Love It**\n\n✅ **2,000+ High-Quality Sound Effects**\n\n✅ **Professionally Organized Categories**\n\n✅ **Multiple Variations for Every Sound Type**\n\n✅ **Works for Any Editing Style**\n\n✅ **Easy to Browse & Use**\n\n✅ **Perfect for Premiere Pro, After Effects, DaVinci Resolve, CapCut, Final Cut Pro, and more**\n\n✅ **Saves Hours of Searching**\n\n✅ **One Purchase. Endless Creative Possibilities.**\n\n---\n\n# 🔥 **Your Complete Sound Design Toolkit**\n\nThe **Ultimate 2000+ Sound Effects Pack** isn't just another SFX collection—it's a complete toolkit built to make your editing workflow faster, smoother, and more professional.\n\nFrom **UI clicks** to **cinematic impacts**, **ambient textures** to **musical transitions**, **Foley** to **power effects**, every sound you need is already organized and ready to use.\n\n**One pack. 2,000+ sounds. Unlimited creativity.**\n\nUpgrade your workflow, save countless hours, and give every project the professional sound design it deserves.\n",
    features: ["Now you won't have to hunt for funds; the stress of finding capital is over."],
    howToUse: [
      {
        step: "Download and use!!",
        detail: "",
      },
    ],
    reviews: [],
  },
];

export function getProduct(slug: string): Product | undefined {
  if (!slug) return undefined;
  const decoded = decodeURIComponent(slug).trim().toLowerCase();
  const spaceVariant = decoded.replace(/-/g, " ");
  const hyphenVariant = decoded.replace(/\s+/g, "-");
  const normalized = decoded.replace(/[^a-z0-9]/g, "");

  return products.find((p) => {
    const pSlug = (p.slug || "").toLowerCase();
    const pId = (p.id || "").toLowerCase();
    const pTitle = (p.title || "").toLowerCase();
    const pNorm = pSlug.replace(/[^a-z0-9]/g, "");
    return (
      pId === decoded ||
      pSlug === decoded ||
      pSlug === spaceVariant ||
      pSlug === hyphenVariant ||
      pTitle === decoded ||
      pNorm === normalized
    );
  });
}
