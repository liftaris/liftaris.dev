import { useEffect, useMemo, useState } from "react";
import { FALLBACK_TOTAL, FALLBACK_DAYS, type ContributionDay } from "./github-data";

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
          if (computedWeeks.length - wIdx >= 3) {
            labels.push({
              name: MONTH_NAMES[month],
              left: wIdx * 13, // 10px width + 3px gap
            });
          }
        }
      }
    });

    return { weeks: computedWeeks, monthLabels: labels };
  }, [data.days]);

  return (
    <div className="github-viewer flex flex-col gap-3 font-mono text-blue select-none w-fit max-w-full min-w-0">
      <div className="github-header flex items-center justify-between gap-3 flex-wrap leading-tight">
        <div className="github-profile flex items-baseline gap-2 text-xs leading-tight">
          <span className="github-handle font-bold text-xs">@liftaris</span>
          <span className="github-separator opacity-50">·</span>
          <span className="github-stats text-xs opacity-90">{data.total.toLocaleString()} contributions in the last year</span>
        </div>

        <a
          href="https://github.com/liftaris"
          target="_blank"
          rel="noopener noreferrer"
          className="github-view-button group inline-flex items-center gap-1.5 px-3 py-1 bg-transparent text-blue border-[1.5px] border-blue rounded font-mono text-xs font-semibold leading-3.5 no-underline cursor-pointer transition-all duration-150 hover:bg-blue hover:text-paper hover:no-underline hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-blue focus-visible:outline-offset-[3px] ml-auto shrink-0"
        >
          <svg className="github-btn-icon size-3.5 shrink-0" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span>View on GitHub</span>
          <span className="github-btn-arrow text-xs leading-none transition-transform duration-120 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true">↗</span>
        </a>
      </div>

      <div className="github-graph-container w-full max-w-full min-w-0 overflow-x-auto overscroll-contain pb-0.5 [scrollbar-width:thin] [scrollbar-color:var(--color-blue)_transparent]" role="region" aria-label="GitHub contribution calendar">
        <div className="github-graph-inner flex flex-col w-fit pr-1.5">
          <div className="github-months grid [grid-auto-flow:column] [grid-auto-columns:10px] gap-[3px] ml-7 mb-1 h-3 relative overflow-hidden" aria-hidden="true">
            {monthLabels.map((m, idx) => (
              <span key={idx} className="github-month-label absolute top-0 text-[10px] leading-3 text-blue whitespace-nowrap" style={{ left: `${m.left}px` }}>
                {m.name}
              </span>
            ))}
          </div>

          <div className="github-grid-wrapper flex gap-1.5 items-start">
            <div className="github-days-labels grid [grid-template-rows:repeat(7,10px)] gap-[3px] text-[9px] leading-[10px] text-blue opacity-75 w-5.5 text-right shrink-0" aria-hidden="true">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            <div className="github-grid flex gap-[3px]" role="grid" aria-label="Contribution grid">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="github-week-col flex flex-col gap-[3px]" role="row">
                  {week.map((day, dIdx) =>
                    day ? (
                      <div
                        key={day.date}
                        className="github-day size-2.5 box-border rounded-[1px] border border-blue bg-transparent cursor-pointer transition-transform duration-75 hover:scale-140 hover:z-[5] hover:outline hover:outline-[1.5px] hover:outline-blue hover:outline-offset-1 focus-visible:scale-140 focus-visible:z-[5] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-blue focus-visible:outline-offset-1 data-[level='0']:bg-transparent data-[level='1']:bg-blue/30 data-[level='2']:bg-blue/55 data-[level='3']:bg-blue/80 data-[level='4']:bg-blue"
                        data-level={day.level}
                        role="gridcell"
                        tabIndex={0}
                        aria-label={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${formatDate(day.date)}`}
                        title={`${day.count} contribution${day.count === 1 ? "" : "s"} on ${formatDate(day.date)}`}
                      />
                    ) : (
                      <div key={`empty-${dIdx}`} className="github-day-placeholder size-2.5 invisible" aria-hidden="true" />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="github-footer flex justify-end items-center mt-2">
            <div className="github-legend flex items-center gap-1 text-[10px] leading-[10px] text-blue [&_span]:px-0.5 [&_.github-day]:cursor-default [&_.github-day]:hover:scale-100 [&_.github-day]:hover:outline-none" aria-hidden="true">
              <span>Less</span>
              <div className="github-day size-2.5 box-border rounded-[1px] border border-blue bg-transparent cursor-pointer transition-transform duration-75 hover:scale-140 hover:z-[5] hover:outline hover:outline-[1.5px] hover:outline-blue hover:outline-offset-1 focus-visible:scale-140 focus-visible:z-[5] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-blue focus-visible:outline-offset-1 data-[level='0']:bg-transparent data-[level='1']:bg-blue/30 data-[level='2']:bg-blue/55 data-[level='3']:bg-blue/80 data-[level='4']:bg-blue" data-level={0} />
              <div className="github-day size-2.5 box-border rounded-[1px] border border-blue bg-transparent cursor-pointer transition-transform duration-75 hover:scale-140 hover:z-[5] hover:outline hover:outline-[1.5px] hover:outline-blue hover:outline-offset-1 focus-visible:scale-140 focus-visible:z-[5] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-blue focus-visible:outline-offset-1 data-[level='0']:bg-transparent data-[level='1']:bg-blue/30 data-[level='2']:bg-blue/55 data-[level='3']:bg-blue/80 data-[level='4']:bg-blue" data-level={1} />
              <div className="github-day size-2.5 box-border rounded-[1px] border border-blue bg-transparent cursor-pointer transition-transform duration-75 hover:scale-140 hover:z-[5] hover:outline hover:outline-[1.5px] hover:outline-blue hover:outline-offset-1 focus-visible:scale-140 focus-visible:z-[5] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-blue focus-visible:outline-offset-1 data-[level='0']:bg-transparent data-[level='1']:bg-blue/30 data-[level='2']:bg-blue/55 data-[level='3']:bg-blue/80 data-[level='4']:bg-blue" data-level={2} />
              <div className="github-day size-2.5 box-border rounded-[1px] border border-blue bg-transparent cursor-pointer transition-transform duration-75 hover:scale-140 hover:z-[5] hover:outline hover:outline-[1.5px] hover:outline-blue hover:outline-offset-1 focus-visible:scale-140 focus-visible:z-[5] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-blue focus-visible:outline-offset-1 data-[level='0']:bg-transparent data-[level='1']:bg-blue/30 data-[level='2']:bg-blue/55 data-[level='3']:bg-blue/80 data-[level='4']:bg-blue" data-level={3} />
              <div className="github-day size-2.5 box-border rounded-[1px] border border-blue bg-transparent cursor-pointer transition-transform duration-75 hover:scale-140 hover:z-[5] hover:outline hover:outline-[1.5px] hover:outline-blue hover:outline-offset-1 focus-visible:scale-140 focus-visible:z-[5] focus-visible:outline focus-visible:outline-[1.5px] focus-visible:outline-blue focus-visible:outline-offset-1 data-[level='0']:bg-transparent data-[level='1']:bg-blue/30 data-[level='2']:bg-blue/55 data-[level='3']:bg-blue/80 data-[level='4']:bg-blue" data-level={4} />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

