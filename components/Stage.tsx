"use client";

import { useEffect, useState } from "react";
import { EXPERIENCE, PROJECTS } from "@/data/portfolio";
import type { ProjectLinkKind } from "@/data/portfolio";

export type StageView = "projects" | "experience";

interface StageProps {
  view?: StageView;
}

interface HermStats {
  stars?: number;
  downloads?: number;
}

function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

function useHermStats() {
  const [stats, setStats] = useState<HermStats>({});

  useEffect(() => {
    const controller = new AbortController();
    const request = (url: string) => fetch(url, { signal: controller.signal }).then((res) => {
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      return res.json();
    });

    Promise.allSettled([
      request("https://api.github.com/repos/liftaris/herm"),
      request("https://api.npmjs.org/downloads/point/last-month/herm-tui"),
    ]).then(([repoResult, npmResult]) => {
      if (controller.signal.aborted) return;
      const repo = repoResult.status === "fulfilled" ? repoResult.value : null;
      const npm = npmResult.status === "fulfilled" ? npmResult.value : null;
      const failures = [repoResult, npmResult].filter((result) => result.status === "rejected");
      if (failures.length > 0) console.warn("Some project statistics could not be loaded", failures);
      setStats({
        stars: typeof repo?.stargazers_count === "number" ? repo.stargazers_count : undefined,
        downloads: typeof npm?.downloads === "number" ? npm.downloads : undefined,
      });
    });

    return () => controller.abort();
  }, []);

  return stats;
}

function linkLabel(projectSlug: string, kind: ProjectLinkKind, label: string, stats: HermStats) {
  if (projectSlug !== "herm") return label;
  if (kind === "github" && stats.stars !== undefined) return `${label} · ${formatCount(stats.stars)}★`;
  if (kind === "npm" && stats.downloads !== undefined) return `${label} · ${formatCount(stats.downloads)}/mo`;
  return label;
}

function ProjectsPane() {
  const hermStats = useHermStats();
  return (
    <div className="pane projectsPane">
      {PROJECTS.map((item) => {
        const primaryHref = item.links.find((link) => link.primary)?.href ?? item.links[0].href;
        return (
          <article className="card" key={item.slug}>
            <div>
              <p>{item.year} / {item.tag}</p>
              <div className="projectTitleRow">
                <h3><a href={primaryHref} target="_blank" rel="noreferrer">{item.name}</a></h3>
                <div className="links">
                  {item.links.map((link) => (
                    <a href={link.href} key={link.kind} target="_blank" rel="noreferrer">{linkLabel(item.slug, link.kind, link.label, hermStats)}</a>
                  ))}
                </div>
              </div>
              <p>{item.body}</p>
              {item.stat && <strong>{item.stat.value} {item.stat.label}</strong>}
              <ul>{item.proof.map((line) => <li key={line}>{line}</li>)}</ul>
              <div className="chips">{item.stack.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function Stage({ view }: StageProps) {
  if (!view) return null;
  if (view === "projects") return <ProjectsPane />;

  const jobs = Object.values(EXPERIENCE);

  return (
    <div className="pane experiencePane">
      {jobs.map((job) => (
        <article className="row" key={job.company}>
          <div><p>{job.period}</p><h3>{job.company}</h3></div>
          <div><p>{job.body}</p></div>
        </article>
      ))}
    </div>
  );
}
