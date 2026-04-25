"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }
  return context;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs",
          "[&_.recharts-cartesian-axis-tick_text]:fill-stone-500",
          "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-stone-200",
          "[&_.recharts-curve.recharts-tooltip-cursor]:stroke-stone-300",
          "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
          "[&_.recharts-layer]:outline-none",
          "[&_.recharts-sector]:outline-none",
          "[&_.recharts-surface]:outline-none",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.color);
  if (!colorConfig.length) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
[data-chart=${id}] {
${colorConfig.map(([key, item]) => `  --color-${key}: ${item.color};`).join("\n")}
}
`
      }}
    />
  );
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  formatter
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
  className?: string;
  formatter?: (value: number | string, name: string) => React.ReactNode;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  return (
    <div className={cn("grid min-w-36 gap-2 rounded-md border border-stone-200 bg-white p-2 text-xs shadow-xl", className)}>
      {label !== undefined ? <div className="font-black text-stone-950">Day {label}</div> : null}
      <div className="grid gap-1">
        {payload
          .filter((item) => item.value !== 0 && item.value !== undefined && item.value !== null)
          .map((item) => {
            const key = String(item.dataKey || item.name || "");
            const itemConfig = config[key];
            const color = item.color || itemConfig?.color || "currentColor";
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-2 text-stone-600">
                  <span className="size-2 rounded-sm" style={{ backgroundColor: color }} />
                  {itemConfig?.label || item.name}
                </span>
                <span className="font-black text-stone-950">
                  {formatter ? formatter(item.value as number | string, key) : item.value}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

