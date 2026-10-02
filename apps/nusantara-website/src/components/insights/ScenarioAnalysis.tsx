"use client";

import { LineChart } from "@/components/market/LineChart";
import { SCENARIO_COLORS } from "@/components/market/chart-utils";
import type { ScenarioSpec } from "@/content/insights/types";

const ORDER = ["downside", "base", "upside"] as const;
const LABEL = { downside: "Downside", base: "Base", upside: "Upside" } as const;

export function projectScenario(spec: ScenarioSpec) {
  return ORDER.map((k) => {
    const path = spec.scenarios[k];
    return {
      key: k,
      label: path.label ?? LABEL[k],
      assumption: path.assumption,
      values: path.values ?? spec.years.map((y) => spec.baseValue * (1 + (path.rate ?? 0)) ** (y - spec.baseYear)),
    };
  });
}

/**
 * NUSANTARA SCENARIO ANALYSIS — reusable research component.
 * Always labelled as scenario analysis; never a forecast, target or promise.
 */
export function ScenarioAnalysis({ spec }: { spec: ScenarioSpec }) {
  const rows = projectScenario(spec);
  const periods = spec.periodLabels ?? spec.years.map(String);
  const fmt = (v: number) =>
    `${new Intl.NumberFormat("en-GB", { minimumFractionDigits: spec.decimals, maximumFractionDigits: spec.decimals }).format(v)}${spec.unit ?? ""}`;

  return (
    <section aria-labelledby={`${spec.id}-title`} className="not-prose my-12 border border-rule bg-white font-sans">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-teal-900 px-5 py-3 text-white md:px-7">
        <p className="eyebrow text-teal-200">Nusantara Scenario Analysis</p>
        <span className="inline-flex items-center gap-1.5 border border-gold-300/60 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gold-200">
          Scenario analysis · not a forecast
        </span>
      </header>
      <div className="px-5 py-6 md:px-7 md:py-8">
        <h3 id={`${spec.id}-title`} className="font-serif text-[1.5rem] leading-snug text-teal-900">
          {spec.title}
        </h3>
        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-rule-soft py-4 text-[12.5px] md:grid-cols-4">
          <div>
            <dt className="text-stone">Base period</dt>
            <dd className="num mt-1 font-medium text-ink">{periods[0]}</dd>
          </div>
          <div>
            <dt className="text-stone">Base value</dt>
            <dd className="num mt-1 font-medium text-ink">{fmt(spec.baseValue)}</dd>
          </div>
          <div>
            <dt className="text-stone">Scenario period</dt>
            <dd className="num mt-1 font-medium text-ink">{spec.period}</dd>
          </div>
          <div>
            <dt className="text-stone">Metric</dt>
            <dd className="mt-1 font-medium text-ink">{spec.metric}</dd>
          </div>
        </dl>

        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2" aria-label="Legend">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-2 text-[12.5px] text-charcoal">
              <span aria-hidden className="block h-0.5 w-5" style={{ background: SCENARIO_COLORS[r.key] }} />
              {r.label} <span className="text-stone">· {r.assumption}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <LineChart
            series={rows.map((r) => ({
              id: r.key,
              label: r.label,
              color: SCENARIO_COLORS[r.key],
              values: r.values,
              emphasis: r.key === "base",
            }))}
            xLabels={periods}
            formatValue={fmt}
            markers
            endLabels
            yAxis="left"
            height={300}
            ariaLabel={`${spec.title}. Scenario analysis, not a forecast. ${rows
              .map((r) => `${r.label} path reaches ${fmt(r.values[r.values.length - 1])} by ${periods[periods.length - 1]}`)
              .join("; ")}.`}
          />
        </div>

        <div className="scrollbar-thin mt-6 overflow-x-auto">
          <table className="w-full min-w-[420px] text-[13px]">
            <caption className="sr-only">{spec.title} — scenario values by period</caption>
            <thead>
              <tr className="border-b border-rule text-left text-[11px] uppercase tracking-[0.1em] text-stone">
                <th scope="col" className="py-2 pr-4 font-semibold">Period</th>
                {rows.map((r) => (
                  <th key={r.key} scope="col" className="py-2 pr-4 text-right font-semibold">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((y, i) => (
                <tr key={y} className="border-b border-rule-soft">
                  <th scope="row" className="num py-2 pr-4 text-left font-normal text-charcoal">
                    {y}
                  </th>
                  {rows.map((r) => (
                    <td key={r.key} className={`num py-2 pr-4 text-right ${r.key === "base" ? "font-medium text-ink" : "text-charcoal"}`}>
                      {fmt(r.values[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-5 text-[12.5px] leading-relaxed text-stone md:grid-cols-2">
          <p>
            <strong className="font-semibold text-charcoal">Data source.</strong> {spec.dataSource}
          </p>
          <p>
            <strong className="font-semibold text-charcoal">Methodology.</strong> {spec.methodology}
          </p>
        </div>
        <p className="mt-5 border-l-2 border-gold-500 pl-4 text-[12.5px] leading-relaxed text-charcoal">
          Scenario analysis illustrates how outcomes differ under stated assumptions. It is not a forecast, performance
          target, expected return or investment promise, and should not be relied upon as such.
        </p>
      </div>
    </section>
  );
}
