export interface Project {
  slug: string;
  name: string;
  tag: string;
  tagline: string;
  year: string;
  stat?: { value: string; label: string };
  stack: string[];
  links: { site?: string; github?: string; npm?: string; blog?: string };
  body: string;
  blurb: string;
  logo?: string;
  proof: string[];
  image?: string;
  featured?: boolean;
}

export const PROJECTS: Record<string, Project> = {
  bazaarghost: {
    slug: "bazaarghost",
    name: "BazaarGhost",
    tag: "Computer vision for Twitch VODs.",
    tagline: "Computer vision for Twitch VODs.",
    year: "2025",
    stat: { value: "18,000+", label: "unique visitors in month one" },
    stack: ["Python", "OpenCV", "PaddleOCR", "FFmpeg", "Twitch EventSub", "Supabase", "GitHub Actions", "Next.js"],
    links: {
      site: "https://bazaarghost.stream",
      github: "https://github.com/liftaris/bazaar-ghost",
      blog: "/blog/bazaar-ghost",
    },
    body: "Indexes Twitch VODs for The Bazaar, detects matchup screens, extracts opponent usernames, and makes appearances searchable at bazaarghost.stream.",
    blurb: "Indexes Twitch VODs for The Bazaar, detects matchup screens, extracts opponent usernames, and makes appearances searchable at bazaarghost.stream.",
    proof: [
      "Discovers Bazaar streamers from Twitch chapter metadata.",
      "Splits VODs into parallel 30-minute processing chunks.",
      "Runs Streamlink, FFmpeg, OpenCV template matching, and PaddleOCR in a containerized SFDE pipeline.",
      "Stores detections, screenshots, and notifications in Supabase.",
    ],
    image: "/BazaarGhost/BG-Vod_Processing_Diagram-Dark.png",
    featured: true,
  },
  herm: {
    slug: "herm",
    name: "Herm TUI",
    tag: "A terminal interface for Hermes Agent.",
    tagline: "A terminal interface for Hermes Agent.",
    year: "2026",
    stack: ["TypeScript", "Bun", "OpenTUI React", "SQLite", "JSON-RPC", "Hermes Agent"],
    links: {
      github: "https://github.com/liftaris/herm",
      npm: "https://www.npmjs.com/package/herm-tui",
    },
    body: "A tabbed, mouse-aware TUI that brings Hermes Agent into an OpenCode-style terminal workspace with chat, sessions, memory, skills, cron, config, analytics, and kanban tabs.",
    blurb: "A tabbed, mouse-aware TUI that brings Hermes Agent into an OpenCode-style terminal workspace with chat, sessions, memory, skills, cron, config, analytics, and kanban tabs.",
    proof: [
      "Streams chat with markdown, images, diff chips, tool-call expansion, and an animated ASCII avatar.",
      "Talks to the same Hermes gateway as the CLI over stdio JSON-RPC.",
      "Supports profile switching, command palette, slash commands, @-refs, rebindable keys, and theme picker.",
    ],
    featured: true,
  },
};

export interface Experience {
  company: string;
  role: string;
  period: string;
  stack: string[];
  body: string;
  summary: string;
  proof: string[];
}

export const EXPERIENCE: Record<string, Experience> = {
  moderna: {
    company: "Moderna",
    role: "Full Stack",
    period: "2023 — Present",
    stack: ["TypeScript", "Next.js", "Angular", "NestJS", "Terraform", "AWS", "GitHub Actions", "AI tooling"],
    body: "Full-stack engineering on internal AI tooling, commercial web platforms, compliance systems, and AWS infrastructure.",
    summary: "Full-stack engineering on internal AI tooling, commercial web platforms, compliance systems, and AWS infrastructure.",
    proof: [
      "Lead developer on an internal AI translation platform.",
      "Built regulatory compliance tooling for Moderna Legal.",
      "Core contributor to the React component system and GitHub Actions CI/CD gating system.",
      "Currently building a multi-tenant microfrontend platform.",
    ],
  },
  freelance: {
    company: "Freelance",
    role: "Full Stack",
    period: "2022 — 2023",
    stack: ["React", "Node.js", "Python"],
    body: "Full-stack web builds and early AI prototypes for small clients.",
    summary: "Full-stack web builds and early AI prototypes for small clients.",
    proof: ["Shipped client projects end to end.", "Built LLM-backed prototypes before the post-ChatGPT tooling wave."],
  },
  healthnote: {
    company: "Health Note",
    role: "Full Stack",
    period: "2022",
    stack: ["React", "Node.js", "PostgreSQL"],
    body: "Patient-intake product work for a digital-health startup automating clinical note-taking.",
    summary: "Patient-intake product work for a digital-health startup automating clinical note-taking.",
    proof: ["Shipped patient-facing intake flows.", "Worked directly with clinical staff on UX."],
  },
  parsons: {
    company: "Parsons",
    role: "Front-End",
    period: "2021 — 2022",
    stack: ["Angular", "TypeScript", "D3.js"],
    body: "Front-end work on geospatial analysis tooling for a defense and infrastructure contractor.",
    summary: "Front-end work on geospatial analysis tooling for a defense and infrastructure contractor.",
    proof: ["Built data-viz dashboards for geospatial analysts.", "Contributed to Angular component systems."],
  },
};

export const SOCIAL = {
  github: "https://github.com/liftaris",
  linkedin: "https://www.linkedin.com/in/kaiobarb",
  email: "mailto:kaio@liftaris.dev",
};

export const PROJECT_SLUGS = Object.keys(PROJECTS);
export const EXPERIENCE_KEYS = Object.keys(EXPERIENCE);

export const PLACES = [];
export const PLACE_KEYS = [];
export const IMAGE_CATALOG: Record<string, string> = {
  profile: "/profile.png",
  "bazaarghost-diagram": "/BazaarGhost/BG-Vod_Processing_Diagram-Dark.png",
};
