'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { SizeClass } from '../lib/types';

interface HistogramChartProps {
  sizeClasses: SizeClass[];
}

const chartConfig = {
  frequency: {
    label: 'Frequency',
    color: 'var(--chart-2)',
  },
};

export function HistogramChart({ sizeClasses }: HistogramChartProps) {
  const data = useMemo(() => {
    return sizeClasses
      .filter(cls => cls.count > 0 || cls.frequency > 0)
      .map(cls => ({
        range: `${cls.sizeMin.toFixed(1)}-${cls.sizeMax.toFixed(1)}`,
        frequency: cls.frequency,
        count: cls.count,
        midpoint: cls.midpoint,
      }))
      .slice(0, 20); // Limit to 20 bars for readability
  }, [sizeClasses]);

  if (data.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Size Distribution Histogram</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No data available
        </CardContent>
      </Card>
    );
  }

  const maxFrequency = Math.max(...data.map(d => d.frequency));

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Size Distribution Histogram</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <BarChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="var(--border)" 
              opacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 8, fill: 'var(--muted-foreground)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              angle={-45}
              textAnchor="end"
              height={60}
              interval={0}
              label={{ 
                value: 'Size Range (mm)', 
                position: 'bottom', 
                offset: 45,
                fontSize: 10,
                fill: 'var(--muted-foreground)'
              }}
            />
            <YAxis
              domain={[0, Math.ceil(maxFrequency * 1.1)]}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              label={{ 
                value: 'Frequency (%)', 
                angle: -90, 
                position: 'insideLeft',
                fontSize: 10,
                fill: 'var(--muted-foreground)'
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, props) => {
                    const item = props.payload as { range?: string; count?: number; frequency?: number };
                    return [
                      <div key="content" className="space-y-1">
                        <div>Range: {item?.range} mm</div>
                        <div>Frequency: {item?.frequency?.toFixed(2)}%</div>
                        <div>Count: {item?.count}</div>
                      </div>,
                      ''
                    ];
                  }}
                />
              }
            />
            <Bar
              dataKey="frequency"
              fill="var(--chart-2)"
              radius={[2, 2, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ChartContainer>

        {/* Summary stats */}
        <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <div>
            <span className="font-medium">Classes:</span> {data.length}
          </div>
          <div>
            <span className="font-medium">Max Freq:</span> {maxFrequency.toFixed(1)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
