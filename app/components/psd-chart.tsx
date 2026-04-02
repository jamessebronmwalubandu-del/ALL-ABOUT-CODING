'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { SizeClass, PSDMetrics } from '../lib/types';
import { generateCumulativeCurve } from '../lib/psd-calculations';

interface PSDChartProps {
  sizeClasses: SizeClass[];
  metrics: PSDMetrics;
}

const chartConfig = {
  passing: {
    label: 'Cum. Passing',
    color: 'var(--chart-1)',
  },
};

export function PSDChart({ sizeClasses, metrics }: PSDChartProps) {
  const data = useMemo(() => {
    const curveData = generateCumulativeCurve(sizeClasses);
    return curveData.map(point => ({
      size: point.size,
      passing: point.passing,
      logSize: Math.log10(Math.max(point.size, 0.001)),
    }));
  }, [sizeClasses]);

  // Format axis tick to show actual size values
  const formatXAxis = (value: number) => {
    const size = Math.pow(10, value);
    if (size >= 100) return `${Math.round(size)}`;
    if (size >= 10) return size.toFixed(0);
    if (size >= 1) return size.toFixed(1);
    return size.toFixed(2);
  };

  const formatTooltip = (value: number, name: string, props: Record<string, unknown>) => {
    const size = (props.payload as { size?: number })?.size || Math.pow(10, value);
    return [`${size.toFixed(2)} mm: ${Number(props.value).toFixed(1)}% passing`, ''];
  };

  // Calculate reference lines for key percentiles
  const referenceLines = useMemo(() => {
    const lines = [];
    if (metrics.d10 > 0) lines.push({ size: metrics.d10, label: 'D10', passing: 10 });
    if (metrics.d50 > 0) lines.push({ size: metrics.d50, label: 'D50', passing: 50 });
    if (metrics.p80 > 0) lines.push({ size: metrics.p80, label: 'P80', passing: 80 });
    if (metrics.d90 > 0) lines.push({ size: metrics.d90, label: 'D90', passing: 90 });
    return lines;
  }, [metrics]);

  if (data.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cumulative Passing Curve</CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No data available
        </CardContent>
      </Card>
    );
  }

  const minLogSize = Math.min(...data.map(d => d.logSize)) - 0.2;
  const maxLogSize = Math.max(...data.map(d => d.logSize)) + 0.2;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Cumulative Passing Curve</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart 
            data={data} 
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
            <XAxis
              dataKey="logSize"
              type="number"
              domain={[minLogSize, maxLogSize]}
              tickFormatter={formatXAxis}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              label={{ 
                value: 'Size (mm) - Log Scale', 
                position: 'bottom', 
                offset: -5,
                fontSize: 10,
                fill: 'var(--muted-foreground)'
              }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              label={{ 
                value: '% Passing', 
                angle: -90, 
                position: 'insideLeft',
                fontSize: 10,
                fill: 'var(--muted-foreground)'
              }}
            />
            <ChartTooltip
              content={<ChartTooltipContent formatter={formatTooltip} />}
            />
            
            {/* Reference lines for key percentiles */}
            {referenceLines.map(ref => (
              <ReferenceLine
                key={ref.label}
                y={ref.passing}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
                strokeOpacity={0.5}
              />
            ))}
            
            <Line
              type="monotone"
              dataKey="passing"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: 'var(--chart-1)' }}
              activeDot={{ r: 5, fill: 'var(--chart-1)' }}
            />
          </LineChart>
        </ChartContainer>

        {/* Legend with key values */}
        <div className="flex flex-wrap gap-4 mt-3 justify-center text-xs">
          {referenceLines.map(ref => (
            <div key={ref.label} className="flex items-center gap-1.5">
              <div 
                className="size-2 rounded-full" 
                style={{ backgroundColor: ref.label === 'P80' ? 'var(--chart-1)' : 'var(--muted-foreground)' }}
              />
              <span className="font-medium">{ref.label}:</span>
              <span className="font-mono">{ref.size.toFixed(2)} mm</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
