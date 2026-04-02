'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  FileImage, 
  Printer,
  Loader2
} from 'lucide-react';
import type { AnalysisResult, SizeClass, PSDMetrics, TrendDataPoint } from '../lib/types';
import {
  generateCSV,
  generateSizeClassCSV,
  generateTrendCSV,
  downloadCSV,
  downloadExcel,
  printPDFReport,
} from '../lib/export-utils';

interface ExportPanelProps {
  results: AnalysisResult[];
  sizeClasses: SizeClass[];
  metrics: PSDMetrics;
  trendData: TrendDataPoint[];
  chartRefs?: {
    psd?: React.RefObject<HTMLDivElement>;
    histogram?: React.RefObject<HTMLDivElement>;
    trend?: React.RefObject<HTMLDivElement>;
  };
}

export function ExportPanel({
  results,
  sizeClasses,
  metrics,
  trendData,
  chartRefs,
}: ExportPanelProps) {
  const [includeParticles, setIncludeParticles] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const csv = generateCSV(results, includeParticles);
      downloadCSV(csv, `psd_analysis_${timestamp}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSizeClassCSV = async () => {
    setIsExporting(true);
    try {
      const csv = generateSizeClassCSV(sizeClasses);
      downloadCSV(csv, `size_distribution_${timestamp}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportTrendCSV = async () => {
    setIsExporting(true);
    try {
      const csv = generateTrendCSV(trendData);
      downloadCSV(csv, `trend_data_${timestamp}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      downloadExcel(results, sizeClasses, trendData, `psd_report_${timestamp}.xls`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      // For now, use print dialog - chart images would need html-to-image
      printPDFReport(results, sizeClasses, metrics, {});
    } finally {
      setIsExporting(false);
    }
  };

  const hasData = results.length > 0 || sizeClasses.some(c => c.count > 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="size-4" />
          Export Data
        </CardTitle>
        <CardDescription className="text-xs">
          Download analysis results in various formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Options */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Include Raw Particles</Label>
            <p className="text-xs text-muted-foreground">
              Add individual particle data to exports
            </p>
          </div>
          <Switch
            checked={includeParticles}
            onCheckedChange={setIncludeParticles}
          />
        </div>

        <Separator />

        {/* CSV Exports */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">CSV Files</Label>
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!hasData || isExporting}
              className="justify-start gap-2"
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileText className="size-4" />
              )}
              Analysis Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSizeClassCSV}
              disabled={!hasData || isExporting}
              className="justify-start gap-2"
            >
              <FileText className="size-4" />
              Size Distribution
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportTrendCSV}
              disabled={trendData.length === 0 || isExporting}
              className="justify-start gap-2"
            >
              <FileText className="size-4" />
              Trend Data
            </Button>
          </div>
        </div>

        <Separator />

        {/* Excel Export */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Excel Workbook</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={!hasData || isExporting}
            className="w-full justify-start gap-2"
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Full Report (Multi-sheet)
          </Button>
        </div>

        <Separator />

        {/* PDF Report */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wide">PDF Report</Label>
          <Button
            variant="default"
            size="sm"
            onClick={handleExportPDF}
            disabled={!hasData || isExporting}
            className="w-full justify-start gap-2"
          >
            {isExporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Printer className="size-4" />
            )}
            Generate PDF Report
          </Button>
          <p className="text-xs text-muted-foreground">
            Opens print dialog - save as PDF
          </p>
        </div>

        {/* Data summary */}
        <div className="pt-2 border-t border-border/50">
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium">Samples:</span> {results.length}
            </div>
            <div>
              <span className="font-medium">Trend Points:</span> {trendData.length}
            </div>
            <div>
              <span className="font-medium">Size Classes:</span> {sizeClasses.filter(c => c.count > 0).length}
            </div>
            <div>
              <span className="font-medium">Total Particles:</span> {metrics.count.toLocaleString()}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
