"use client";

import { useEffect, useState } from "react";
import { EXPERIENCE, PROJECTS } from "@/data/portfolio";

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
    let live = true;
    Promise.all([
      fetch("https://api.github.com/repos/liftaris/herm").then((res) => res.ok ? res.json() : null),
      fetch("https://api.npmjs.org/downloads/point/last-month/herm-tui").then((res) => res.ok ? res.json() : null),
    ])
      .then(([repo, npm]) => {
        if (!live) return;
        setStats({
          stars: typeof repo?.stargazers_count === "number" ? repo.stargazers_count : undefined,
          downloads: typeof npm?.downloads === "number" ? npm.downloads : undefined,
        });
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, []);

  return stats;
}

function linkLabel(projectSlug: string, key: string, stats: HermStats) {
  if (projectSlug !== "herm") return key;
  if (key === "github" && stats.stars !== undefined) return `${key} · ${formatCount(stats.stars)}★`;
  if (key === "npm" && stats.downloads !== undefined) return `${key} · ${formatCount(stats.downloads)}/mo`;
  return key;
}

export function Stage({ view }: StageProps) {
  const hermStats = useHermStats();
  const projects = [PROJECTS.herm, PROJECTS.bazaarghost];
  const jobs = Object.values(EXPERIENCE);

  if (!view) return null;

  if (view === "projects") {
    return (
      <div className="pane projectsPane">
        {projects.map((item) => (
          <article className="card" key={item.slug}>
            <div>
              <p>{item.year} / {item.tag}</p>
              <div className="projectTitleRow">
                <h3><a href={item.links.github} target="_blank" rel="noreferrer">{item.name}</a></h3>
                <div className="links">
                  {Object.entries(item.links).filter((link): link is [string, string] => Boolean(link[1])).map(([key, href]) => (
                    <a href={href} key={key} target="_blank" rel="noreferrer">{linkLabel(item.slug, key, hermStats)}</a>
                  ))}
                </div>
              </div>
              <p>{item.body}</p>
              {item.stat && <strong>{item.stat.value} {item.stat.label}</strong>}
              <ul>{item.proof.map((line) => <li key={line}>{line}</li>)}</ul>
              <div className="chips">{item.stack.slice(0, 6).map((tag) => <span key={tag}>{tag}</span>)}</div>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div className="pane experiencePane">
      <p className="experienceSummary"><strong>Full-stack, customer-facing work across AI tooling, regulated platforms, component systems, CI/CD infrastructure, and data-heavy product interfaces.</strong></p>
      {jobs.map((job) => (
        <article className="row" key={job.company}>
          <div><p>{job.period}</p><h3>{job.company}</h3><p>{job.role}</p></div>
          <div><ul>{job.proof.map((line) => <li key={line}>{line}</li>)}</ul></div>
        </article>
      ))}
    </div>
  );
}
