import type { Metadata } from "next";
import { Stage } from "@/components/Stage";

export const metadata: Metadata = { title: "Experience | Kaio Barbosa-Chifan" };

export default function ExperiencePage() {
  return <Stage view="experience" />;
}
