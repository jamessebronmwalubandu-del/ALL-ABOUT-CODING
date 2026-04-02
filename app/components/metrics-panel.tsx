'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { PSDMetrics } from '../lib/types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricsPanelProps {
  metrics: PSDMetrics;
  previousMetrics?: PSDMetrics | null;
  isProcessing: boolean;
}

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  previousValue?: number;
  highlight?: boolean;
  description?: string;
}

function MetricCard({ label, value, unit, previousValue, highlight, description }: MetricCardProps) {
  const change = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
  const showTrend = previousValue !== undefined && Math.abs(change) > 0.1;

  return (
    <div className={`p-3 rounded-lg ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/50'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {showTrend && (
          <span className={`flex items-center gap-0.5 text-xs ${
            change > 0 ? 'text-yellow-500' : change < 0 ? 'text-green-500' : 'text-muted-foreground'
          }`}>
            {change > 0 ? (
              <TrendingUp className="size-3" />
            ) : change < 0 ? (
              <TrendingDown className="size-3" />
            ) : (
              <Minus className="size-3" />
            )}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-xl font-bold font-mono ${highlight ? 'text-primary' : ''}`}>
          {value.toFixed(2)}
        </span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
      {description && (
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  );
}

export function MetricsPanel({ metrics, previousMetrics, isProcessing }: MetricsPanelProps) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Live Metrics</h3>
          <div className="flex items-center gap-2">
            <div className={`size-2 rounded-full ${isProcessing ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
            <span className="text-xs text-muted-foreground">
              {isProcessing ? 'Processing' : 'Idle'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Primary metrics - P80 highlighted */}
          <MetricCard
            label="P80"
            value={metrics.p80}
            unit="mm"
            previousValue={previousMetrics?.p80}
            highlight
            description="80% passing size"
          />
          <MetricCard
            label="D50"
            value={metrics.d50}
            unit="mm"
            previousValue={previousMetrics?.d50}
            highlight
            description="Median size"
          />
          
          {/* Secondary metrics */}
          <MetricCard
            label="D10"
            value={metrics.d10}
            unit="mm"
            previousValue={previousMetrics?.d10}
            description="10% passing"
          />
          <MetricCard
            label="D90"
            value={metrics.d90}
            unit="mm"
            previousValue={previousMetrics?.d90}
            description="90% passing"
          />
          
          {/* Additional stats */}
          <MetricCard
            label="Mean"
            value={metrics.mean}
            unit="mm"
            previousValue={previousMetrics?.mean}
          />
          <MetricCard
            label="Span"
            value={metrics.span}
            unit=""
            previousValue={previousMetrics?.span}
            description="(D90-D10)/D50"
          />
          
          {/* Size range */}
          <div className="p-3 rounded-lg bg-secondary/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Size Range
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold font-mono">
                {metrics.min.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">-</span>
              <span className="text-lg font-bold font-mono">
                {metrics.max.toFixed(2)}
              </span>
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
          </div>
          
          {/* Particle count */}
          <div className="p-3 rounded-lg bg-secondary/50">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Particles
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">
                {metrics.count.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              CV: {metrics.cv.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* F80 for Work Index */}
        <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                F80 (Feed Size)
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-bold font-mono">
                  {metrics.f80.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">mm</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Reduction Ratio
              </span>
              <div className="flex items-baseline gap-1 mt-1 justify-end">
                <span className="text-lg font-bold font-mono">
                  {metrics.p80 > 0 ? (metrics.f80 / metrics.p80).toFixed(2) : '-'}
                </span>
                <span className="text-xs text-muted-foreground">:1</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
