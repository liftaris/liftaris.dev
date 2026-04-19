import type { Metadata } from "next";
import { SideColumn } from "@/components/SideColumn";
import { EXPERIENCE_KEYS } from "@/data/portfolio";
import type { TileSpec } from "@/lib/tiles";

export const metadata: Metadata = { title: "Work | KAIO" };

const LEFT: TileSpec[] = EXPERIENCE_KEYS.map((company) => ({
  kind: "experience" as const,
  company,
}));

const RIGHT: TileSpec[] = [
  { kind: "stat", value: "82", label: "merged PRs", sublabel: "across 13 repos @ Moderna" },
  {
    kind: "stack",
    title: "Production stack",
    items: [
      "TypeScript",
      "React",
      "Next.js",
      "Angular",
      "NestJS",
      "Terraform",
      "AWS",
      "Docker",
      "PostgreSQL",
    ],
  },
  {
    kind: "text",
    title: "Scope",
    body: "Marketing web platform, Vaccine Finder, FMV compliance tooling, AWS WAF hardening, CI/CD, accessibility automation.",
  },
  {
    kind: "link",
    href: "https://www.linkedin.com/in/kaiobarb",
    title: "Full history on LinkedIn",
    subtitle: "linkedin.com/in/kaiobarb",
  },
];

export default function WorkPage() {
  return (
    <>
      <SideColumn side="left" fallback={LEFT} />
      <SideColumn side="right" fallback={RIGHT} />
    </>
  );
}
