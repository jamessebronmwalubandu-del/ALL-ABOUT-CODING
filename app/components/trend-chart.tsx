'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { TrendDataPoint } from '../lib/types';

interface TrendChartProps {
  data: TrendDataPoint[];
  maxPoints?: number;
}

const chartConfig = {
  p80: {
    label: 'P80',
    color: 'var(--chart-1)',
  },
  d50: {
    label: 'D50',
    color: 'var(--chart-2)',
  },
  d10: {
    label: 'D10',
    color: 'var(--chart-3)',
  },
  d90: {
    label: 'D90',
    color: 'var(--chart-4)',
  },
};

export function TrendChart({ data, maxPoints = 60 }: TrendChartProps) {
  const chartData = useMemo(() => {
    const recentData = data.slice(-maxPoints);
    return recentData.map((point, index) => ({
      time: point.timestamp.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      }),
      index,
      p80: point.p80,
      d50: point.d50,
      d10: point.d10,
      d90: point.d90,
      count: point.count,
    }));
  }, [data, maxPoints]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return null;
    
    const p80Values = chartData.map(d => d.p80).filter(v => v > 0);
    if (p80Values.length === 0) return null;
    
    const avg = p80Values.reduce((a, b) => a + b, 0) / p80Values.length;
    const min = Math.min(...p80Values);
    const max = Math.max(...p80Values);
    const stdDev = Math.sqrt(
      p80Values.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / p80Values.length
    );
    
    return { avg, min, max, stdDev };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">P80 / D50 Trend</CardTitle>
          <CardDescription className="text-xs">Real-time tracking over time</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          Collecting data...
        </CardContent>
      </Card>
    );
  }

  const allValues = chartData.flatMap(d => [d.p80, d.d50, d.d10, d.d90]).filter(v => v > 0);
  const minY = Math.max(0, Math.min(...allValues) * 0.9);
  const maxY = Math.max(...allValues) * 1.1;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">P80 / D50 Trend</CardTitle>
            <CardDescription className="text-xs">
              Last {chartData.length} measurements
            </CardDescription>
          </div>
          {stats && (
            <div className="text-right text-xs">
              <div className="text-muted-foreground">P80 Avg: <span className="font-mono font-medium text-foreground">{stats.avg.toFixed(2)}</span> mm</div>
              <div className="text-muted-foreground">StdDev: <span className="font-mono font-medium text-foreground">{stats.stdDev.toFixed(2)}</span> mm</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="var(--border)" 
              opacity={0.5}
            />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minY, maxY]}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={{ stroke: 'var(--border)' }}
              tickFormatter={(value) => value.toFixed(1)}
              label={{ 
                value: 'Size (mm)', 
                angle: -90, 
                position: 'insideLeft',
                fontSize: 10,
                fill: 'var(--muted-foreground)'
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) => [
                    `${Number(value).toFixed(2)} mm`,
                    name
                  ]}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            
            <Line
              type="monotone"
              dataKey="p80"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--chart-1)' }}
            />
            <Line
              type="monotone"
              dataKey="d50"
              stroke="var(--chart-2)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: 'var(--chart-2)' }}
            />
            <Line
              type="monotone"
              dataKey="d10"
              stroke="var(--chart-3)"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              activeDot={{ r: 3, fill: 'var(--chart-3)' }}
            />
            <Line
              type="monotone"
              dataKey="d90"
              stroke="var(--chart-4)"
              strokeWidth={1}
              strokeDasharray="3 3"
              dot={false}
              activeDot={{ r: 3, fill: 'var(--chart-4)' }}
            />
          </LineChart>
        </ChartContainer>

        {/* Min/Max stats */}
        {stats && (
          <div className="flex justify-center gap-6 mt-3 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">P80 Min:</span> {stats.min.toFixed(2)} mm
            </div>
            <div>
              <span className="font-medium">P80 Max:</span> {stats.max.toFixed(2)} mm
            </div>
            <div>
              <span className="font-medium">Range:</span> {(stats.max - stats.min).toFixed(2)} mm
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
