import { useEffect, useMemo, useState } from "react";
import { FALLBACK_TOTAL, FALLBACK_DAYS, type ContributionDay } from "./github-data";
import "./github-viewer.css";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${MONTH_NAMES[month]} ${day}, ${year}`;
}

export function GitHubViewer() {
  const [data, setData] = useState<{ total: number; days: ContributionDay[] }>({
    total: FALLBACK_TOTAL,
    days: FALLBACK_DAYS,
  });

  useEffect(() => {
    let active = true;
    void fetch("/api/github/contributions")
      .then((res) => (res.ok ? (res.json() as Promise<{ total?: number; days?: ContributionDay[] }>) : null))
      .then((result) => {
        if (!active || !result || !Array.isArray(result.days)) return;
        setData({
          total: typeof result.total === "number" ? result.total : FALLBACK_TOTAL,
          days: result.days,
        });
      })
      .catch(() => {
        // Fallback already in place
      });
    return () => {
      active = false;
    };
  }, []);

  const { weeks, monthLabels } = useMemo(() => {
    const days = data.days;
    const computedWeeks: (ContributionDay | null)[][] = [];
    let currentWeek: (ContributionDay | null)[] = [];

    if (days.length > 0) {
      const firstDate = new Date(days[0].date + "T00:00:00Z");
      const firstDayOfWeek = firstDate.getUTCDay();
      for (let i = 0; i < firstDayOfWeek; i++) {
        currentWeek.push(null);
      }
    }

    for (const day of days) {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        computedWeeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      computedWeeks.push(currentWeek);
    }

    // Determine month label positions
    const labels: Array<{ name: string; left: number }> = [];
    let lastMonth = -1;

    computedWeeks.forEach((week, wIdx) => {
      const firstValidDay = week.find((d): d is ContributionDay => d !== null);
      if (firstValidDay) {
        const month = parseInt(firstValidDay.date.split("-")[1], 10) - 1;
        if (month !== lastMonth) {
          lastMonth = month;
          labels.push({
            name: MONTH_NAMES[month],
            left: wIdx * 13, // 10px width + 3px gap
          });
        }
      }
    });

    return { weeks: computedWeeks, monthLabels: labels };
  }, [data.days]);

  return (
    <div className="github-viewer">
      <div className="github-header">
        <div className="github-profile">
          <span className="github-handle">@liftaris</span>
          <span className="github-separator">·</span>
          <span className="github-stats">{data.total.toLocaleString()} contributions in the last year</span>
        </div>
      </div>

      <div className="github-graph-container" role="region" aria-label="GitHub contribution calendar">
        <div className="github-graph-inner">
          <div className="github-months" aria-hidden="true">
            {monthLabels.map((m, idx) => (
              <span key={idx} className="github-month-label" style={{ left: `${m.left}px` }}>
                {m.name}
              </span>
            ))}
          </div>

          <div className="github-grid-wrapper">
            <div className="github-days-labels" aria-hidden="true">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="github-grid" role="grid" aria-label="Contribution grid">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="github-week-col" role="row">
                  {week.map((day, dIdx) =>
                    day ? (
                      <div
                        key={day.date}
                        className="github-day"
                        data-level={day.level}
                        role="gridcell"
                        tabIndex={0}
                        aria-label={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${formatDate(day.date)}`}
                        title={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${formatDate(day.date)}`}
                      />
                    ) : (
                      <div key={`empty-${dIdx}`} className="github-day-placeholder" aria-hidden="true" />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="github-footer">
            <div className="github-legend" aria-hidden="true">
              <span>Less</span>
              <div className="github-day" data-level={0} />
              <div className="github-day" data-level={1} />
              <div className="github-day" data-level={2} />
              <div className="github-day" data-level={3} />
              <div className="github-day" data-level={4} />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>

      <div className="github-actions">
        <a
          href="https://github.com/liftaris"
          target="_blank"
          rel="noopener noreferrer"
          className="github-view-button"
        >
          <svg className="github-btn-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>View on GitHub</span>
          <span className="github-btn-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}
