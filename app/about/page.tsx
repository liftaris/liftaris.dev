import client from "@/tina/__generated__/client";
import type {
  AboutQuery,
  AboutQueryVariables,
} from "@/tina/__generated__/types";
import AboutClient from "@/components/tina/AboutClient";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { GridPattern } from "@/components/ui/grid-pattern";
import type { Metadata } from "next";

async function getSiteConfig() {
  const config = await import("@/data/config.json");
  return { title: config.title };
}

async function getAboutData() {
  const variables: AboutQueryVariables = { relativePath: "about.md" };

  try {
    const res = await client.queries.about(variables);
    return {
      data: res.data,
      query: res.query,
      variables,
    };
  } catch {
    return {
      data: {} as AboutQuery,
      query: "",
      variables,
    };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getSiteConfig();
  return {
    title: `About | ${config.title}`,
  };
}

export default async function AboutPage() {
  const [aboutData, config] = await Promise.all([
    getAboutData(),
    getSiteConfig(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Header siteTitle={config.title} />
      <main className="pt-[73px]">
        {/* Hero section for About page */}
        <section className="relative border-b border-border py-20 overflow-hidden">
          <GridPattern
            width={50}
            height={50}
            strokeDasharray="3 3"
            className="opacity-20"
          />
          <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              About
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              A little bit about me and what I do
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-16">
          <div className="mx-auto max-w-3xl px-6">
            <AboutClient {...aboutData} />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
