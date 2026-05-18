import type { Metadata } from "next";
import { Stage } from "@/components/Stage";

export const metadata: Metadata = { title: "Projects | Kaio Barbosa-Chifan" };

export default function ProjectsPage() {
  return <Stage view="projects" />;
}
