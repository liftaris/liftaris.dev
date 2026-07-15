export interface Project {
  slug: string;
  name: string;
  tag: string;
  year: string;
  stat?: { value: string; label: string };
  stack: string[];
  links: ProjectLink[];
  body: string;
  proof: string[];
}

export type ProjectLinkKind = "site" | "github" | "npm" | "blog";

export interface ProjectLink {
  kind: ProjectLinkKind;
  label: string;
  href: string;
  primary?: boolean;
}

export const PROJECTS: Project[] = [
  {
    slug: "herm",
    name: "Herm TUI",
    tag: "A terminal interface for Hermes Agent.",
    year: "2026",
    stack: ["TypeScript", "Bun", "OpenTUI React", "SQLite", "JSON-RPC", "Hermes Agent"],
    links: [
      { kind: "github", label: "github", href: "https://github.com/liftaris/herm", primary: true },
      { kind: "npm", label: "npm", href: "https://www.npmjs.com/package/herm-tui" },
    ],
    body: "A tabbed, mouse-aware TUI that brings Hermes Agent into an OpenCode-style terminal workspace with chat, sessions, memory, skills, cron, config, analytics, and kanban tabs.",
    proof: [
      "Streams chat with markdown, images, diff chips, tool-call expansion, and an animated ASCII avatar.",
      "Talks to the same Hermes gateway as the CLI over stdio JSON-RPC.",
      "Supports profile switching, command palette, slash commands, @-refs, rebindable keys, and theme picker.",
    ],
  },
  {
    slug: "bazaarghost",
    name: "BazaarGhost",
    tag: "Computer vision for Twitch VODs.",
    year: "2025",
    stat: { value: "18,000+", label: "unique visitors in month one" },
    stack: ["Python", "OpenCV", "PaddleOCR", "FFmpeg", "Twitch EventSub", "Supabase", "GitHub Actions", "Next.js"],
    links: [
      { kind: "site", label: "site", href: "https://bazaarghost.stream", primary: true },
      { kind: "github", label: "github", href: "https://github.com/liftaris/bazaar-ghost" },
      { kind: "blog", label: "blog", href: "/blog/bazaar-ghost" },
    ],
    body: "Indexes Twitch VODs for The Bazaar, detects matchup screens, extracts opponent usernames, and makes appearances searchable at bazaarghost.stream.",
    proof: [
      "Discovers Bazaar streamers from Twitch chapter metadata.",
      "Splits VODs into parallel 30-minute processing chunks.",
      "Runs Streamlink, FFmpeg, OpenCV template matching, and PaddleOCR in a containerized SFDE pipeline.",
      "Stores detections, screenshots, and notifications in Supabase.",
    ],
  },
];

export interface Experience {
  company: string;
  period: string;
  body: string;
}

export const EXPERIENCE: Record<string, Experience> = {
  moderna: {
    company: "Moderna",
    period: "2023 — Present",
    body: "I'm on the Commercial Websites team. On any given day, I may be building new global experiences, wrangling infrastructure in AWS, or building new front-end experiences in React for 100s of thousands of users. These days, our team is building out a new module-federated platform to power the next generation of Moderna's commercial websites, which keeps me busy. In this role, I've had the opportunity to lead the development of an LLM powered translation tool for commercial usage, and a critical regulatory platform for healthcare professionals with complex business requirements.",
  },
  freelance: {
    company: "Freelance",
    period: "2022 — 2023",
    body: "Started doing bounties on Replit's now decommissioned bounty program, and gained a wealth of experience doing random things. A LoRA style marketplace for artists, a Unity game, several React/Next dashboards and prototypes, and a WASM binding for HSNWLib.",
  },
  healthnote: {
    company: "Health Note",
    period: "2022",
    body: "Health Note was a great period of growth for me. Being a small startup, it refined my fronted skills as well as rounded me out. I worked closely with the CTO, made product decisions, and of course, moved quickly. Health Note was assisting clinics and physicians with \"AI\" before ChatGPT exploded onto the scene, and it was a rewarding experience.",
  },
  parsons: {
    company: "Parsons",
    period: "2021 — 2022",
    body: "In my first professional stint as a software dev, I built dashboards for the FAA and CBP. That's basically all I did: data visualization in a SPA, following mocks to a T. With React, yeah.",
  },
};

export const SOCIAL = {
  github: "https://github.com/liftaris",
  linkedin: "https://www.linkedin.com/in/kaiobarb",
  email: "mailto:kaio@liftaris.dev",
};
