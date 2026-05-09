'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PSDChart } from '@/app/components/psd-chart';
import { HistogramChart } from '@/app/components/histogram-chart';
import { TrendChart } from '@/app/components/trend-chart';
import { MetricsPanel } from '@/app/components/metrics-panel';
import { ExportPanel } from '@/app/components/export-panel';
import { BarChart3 } from 'lucide-react';
import { useAppStore } from '@/lib/useAppStore';

export default function ResultsPage() {
  const metrics = useAppStore((state) => state.metrics);
  const previousMetrics = useAppStore((state) => state.previousMetrics);
  const sizeClasses = useAppStore((state) => state.sizeClasses);
  const trendData = useAppStore((state) => state.trendData);
  const results = useAppStore((state) => state.results);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <BarChart3 className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Results</h1>
          <p className="text-xs text-muted-foreground">PSD curves, histograms, and trends</p>
        </div>
      </div>

      {/* Charts Tabs */}
      <Tabs defaultValue="psd" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="psd" className="text-sm">
            Cumulative Curve
          </TabsTrigger>
          <TabsTrigger value="histogram" className="text-sm">
            Histogram
          </TabsTrigger>
          <TabsTrigger value="trend" className="text-sm">
            Trend Analysis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="psd" className="flex-1 mt-4">
          <div className="bg-card/50 rounded-lg border border-border/50 p-4 h-full">
            <PSDChart sizeClasses={sizeClasses} metrics={metrics} />
          </div>
        </TabsContent>

        <TabsContent value="histogram" className="flex-1 mt-4">
          <div className="bg-card/50 rounded-lg border border-border/50 p-4 h-full">
            <HistogramChart sizeClasses={sizeClasses} />
          </div>
        </TabsContent>

        <TabsContent value="trend" className="flex-1 mt-4">
          <div className="bg-card/50 rounded-lg border border-border/50 p-4 h-full">
            <TrendChart data={trendData} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom Section: Metrics and Export */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card/50 rounded-lg border border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-3">Current Metrics</h3>
          <MetricsPanel
            metrics={metrics}
            previousMetrics={previousMetrics}
            isProcessing={false}
          />
        </div>

        <div className="bg-card/50 rounded-lg border border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-3">Export & Tools</h3>
          <ExportPanel
            results={results}
            sizeClasses={sizeClasses}
            metrics={metrics}
            trendData={trendData}
          />
        </div>
      </div>
    </div>
  );
}
