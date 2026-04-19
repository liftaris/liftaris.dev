export interface Project {
  slug: string;
  name: string;
  tagline: string;
  year: string;
  status: "active" | "maintained" | "archived";
  stat?: { value: string; label: string };
  stack: string[];
  logo?: string;
  image?: string;
  links: { site?: string; github?: string; blog?: string; npm?: string };
  blurb: string;
  featured?: boolean;
}

export const PROJECTS: Record<string, Project> = {
  bazaarghost: {
    slug: "bazaarghost",
    name: "BazaarGhost",
    tagline: "See your ghost go up against Twitch streamers in The Bazaar",
    year: "2025",
    status: "active",
    stat: { value: "18,000+", label: "unique visitors · month one" },
    stack: ["Python", "OpenCV", "PaddleOCR", "FFmpeg", "Next.js", "Supabase", "GitHub Actions"],
    logo: "/icons/bazaarghost-logo.svg",
    image: "/BazaarGhost/web-app-manifest-512x512.png",
    links: {
      site: "https://bazaarghost.stream",
      github: "https://github.com/liftaris/bazaar-ghost",
      blog: "/blog/bazaar-ghost",
    },
    blurb:
      "Computer-vision pipeline that indexes Twitch VODs, detects matchup screens, OCRs usernames, and links players to the exact moment a streamer fought their ghost. Zero hosting cost — compute runs entirely on GitHub Actions.",
    featured: true,
  },
  shaderweb: {
    slug: "shaderweb",
    name: "ShaderWeb",
    tagline: "GLSL learning platform with AI-validated practice problems",
    year: "2024",
    status: "maintained",
    stack: ["React", "WebGL", "GLSL", "D3.js", "Claude API", "Supabase"],
    image: "/images/shaderweb-preview.svg",
    links: {},
    blurb:
      "Live shader editor paired with a WebGL-heatmap knowledge graph. Claude validates user solutions and generates practice problems on demand.",
    featured: true,
  },
  "hnswlib-wasm": {
    slug: "hnswlib-wasm",
    name: "hnswlib-wasm",
    tagline: "Approximate nearest-neighbor search in the browser",
    year: "2024",
    status: "maintained",
    stack: ["C++", "Emscripten", "WASM", "TypeScript"],
    links: {
      github: "https://github.com/liftaris/hnswlib-wasm",
    },
    blurb:
      "WebAssembly bindings for hnswlib. HNSW index build + query with L2 / IP / cosine, fully client-side. Built for browser-native RAG.",
  },
  lsystems: {
    slug: "lsystems",
    name: "LSystems",
    tagline: "Fractal turtle graphics in C + SDL2",
    year: "2023",
    status: "archived",
    stack: ["C", "SDL2"],
    image: "/LSystemN3.gif",
    links: {
      github: "https://github.com/liftaris/LSystems",
      blog: "/blog/Understanding-L-Systems",
    },
    blurb:
      "Lindenmayer-system renderer written while working through The Algorithmic Beauty of Plants. Pure recursion, no dependencies beyond SDL.",
  },
  "liftaris-dev": {
    slug: "liftaris-dev",
    name: "liftaris.dev",
    tagline: "This site — chat-driven portfolio with generative UI",
    year: "2026",
    status: "active",
    stack: ["Next.js 16", "AI SDK", "pgvector", "Tailwind 4", "Supabase"],
    links: { github: "https://github.com/liftaris/liftaris.dev" },
    blurb:
      "Portfolio where the chatbot *is* the navigation. Tool calls drive route changes and compose the surrounding tiles from a structured corpus.",
    featured: true,
  },
};

export interface Experience {
  company: string;
  role: string;
  period: string;
  location: string;
  stack: string[];
  summary: string;
  highlights: string[];
}

export const EXPERIENCE: Record<string, Experience> = {
  moderna: {
    company: "Moderna",
    role: "Software Development Engineer II",
    period: "2023 — Present",
    location: "Seattle, WA",
    stack: ["TypeScript", "Next.js", "Angular", "NestJS", "Terraform", "AWS", "Contentful"],
    summary:
      "Full-stack engineer on Commercial Digital Innovation & Engagement. Owns marketing web platform, Vaccine Finder, FMV compliance tooling, and supporting AWS infrastructure.",
    highlights: [
      "82 merged PRs across 13 repositories",
      "Built Vaccine Finder 'Search This Area' + Walgreens partner-API integration",
      "Designed phased AWS WAF hardening for marketing CDN",
      "32 PRs on FMV compliance platform (Angular + NestJS + SQL Server)",
    ],
  },
  freelance: {
    company: "Freelance",
    role: "Full-Stack Developer",
    period: "2022 — 2023",
    location: "Remote",
    stack: ["React", "Node.js", "Python"],
    summary:
      "Contract work: full-stack web builds and early-stage AI prototypes for small clients.",
    highlights: ["Shipped 4 client projects end-to-end", "Prototyped LLM-backed tooling pre-ChatGPT-boom"],
  },
  healthnote: {
    company: "Health Note",
    role: "Full-Stack Engineer",
    period: "2022",
    location: "San Diego, CA",
    stack: ["React", "Node.js", "PostgreSQL"],
    summary:
      "Built patient-intake features for a digital-health startup automating clinical note-taking.",
    highlights: ["Shipped patient-facing intake flows", "Worked directly with clinical staff on UX"],
  },
  parsons: {
    company: "Parsons",
    role: "Front-End Engineer",
    period: "2021 — 2022",
    location: "Remote",
    stack: ["Angular", "TypeScript", "D3.js"],
    summary:
      "Front-end work on geospatial analysis tooling for a defense & infrastructure contractor.",
    highlights: ["Data-viz dashboards for geospatial analysts", "Angular component library contributions"],
  },
};

export interface Place {
  key: string;
  label: string;
  coords: [number, number];
  zoom: number;
  prompt: string;
}

export const PLACES: Place[] = [
  { key: "seattle", label: "Seattle, WA", coords: [47.6062, -122.3353], zoom: 11, prompt: "Tell me about Kaio's time in Seattle" },
  { key: "natal", label: "Pirangi, Brasil", coords: [-5.9760, -35.1208], zoom: 12, prompt: "Tell me about Kaio growing up in Brazil" },
  { key: "bayarea", label: "Bay Area, CA", coords: [37.9735, -122.5311], zoom: 10, prompt: "Tell me about Kaio's time in the Bay Area" },
  { key: "cdmx", label: "Mexico City", coords: [19.4326, -99.1332], zoom: 11, prompt: "Tell me about Kaio's time in Mexico City" },
  { key: "auroville", label: "Auroville, India", coords: [12.0052, 79.8069], zoom: 13, prompt: "Tell me about Kaio's time in Auroville" },
  { key: "bordeaux", label: "Bordeaux, France", coords: [44.8378, -0.5792], zoom: 11, prompt: "Tell me about Kaio's time in Bordeaux" },
];

export const SOCIAL = {
  github: "https://github.com/liftaris",
  linkedin: "https://www.linkedin.com/in/kaiobarb",
  email: "mailto:kaio@liftaris.dev",
};

// Flatten for prompt injection
export const PROJECT_SLUGS = Object.keys(PROJECTS);
export const EXPERIENCE_KEYS = Object.keys(EXPERIENCE);
export const PLACE_KEYS = PLACES.map((p) => p.key);

// Known-safe images the model may reference in image tiles
export const IMAGE_CATALOG: Record<string, string> = {
  profile: "/profile.png",
  "bazaarghost-diagram": "/BazaarGhost/BG-Vod_Processing_Diagram-Dark.png",
  "bazaarghost-analytics": "/BazaarGhost/vercel_analytics.png",
  "bazaarghost-reddit": "/BazaarGhost/reddit_ghost_interest.png",
  "lsystems-n2": "/LSystemN2.gif",
  "lsystems-n3": "/LSystemN3.gif",
  "lsystems-concept": "/LSystemConcept.jpeg",
};
