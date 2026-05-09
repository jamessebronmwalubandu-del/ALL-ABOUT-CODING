// Export utilities for PDF, Excel, and CSV generation
import type { AnalysisResult, PSDMetrics, SizeClass, TrendDataPoint } from './types';

/**
 * Generate CSV content from analysis results
 */
export function generateCSV(
  results: AnalysisResult[],
  includeParticles: boolean = false
): string {
  const lines: string[] = [];
  
  // Header for summary data
  lines.push('Timestamp,Count,D10 (mm),D50 (mm),D80 (mm),D90 (mm),P80 (mm),F80 (mm),Reduction Ratio,Mean (mm),Min (mm),Max (mm),CV (%)');
  
  for (const result of results) {
    const m = result.metrics;
    lines.push([
      result.timestamp.toISOString(),
      m.count,
      m.d10.toFixed(3),
      m.d50.toFixed(3),
      m.d80.toFixed(3),
      m.d90.toFixed(3),
      m.p80.toFixed(3),
      m.f80.toFixed(3),
      m.reductionRatio.toFixed(3),
      m.mean.toFixed(3),
      m.min.toFixed(3),
      m.max.toFixed(3),
      m.cv.toFixed(2),
    ].join(','));
  }
  
  if (includeParticles && results.length > 0) {
    lines.push('');
    lines.push('--- Individual Particles ---');
    lines.push('Result ID,Particle ID,Diameter (mm),Area (px),Perimeter (px),Circularity,Aspect Ratio');
    
    for (const result of results) {
      for (const particle of result.particles) {
        lines.push([
          result.id,
          particle.id,
          particle.diameter.toFixed(3),
          particle.area,
          particle.perimeter.toFixed(1),
          particle.circularity.toFixed(3),
          particle.aspectRatio.toFixed(3),
        ].join(','));
      }
    }
  }
  
  return lines.join('\n');
}

/**
 * Generate size class CSV
 */
export function generateSizeClassCSV(sizeClasses: SizeClass[]): string {
  const lines: string[] = [];
  
  lines.push('Size Min (mm),Size Max (mm),Midpoint (mm),Count,Frequency (%),Cum Retained (%),Cum Passing (%)');
  
  for (const cls of sizeClasses) {
    lines.push([
      cls.sizeMin.toFixed(3),
      cls.sizeMax.toFixed(3),
      cls.midpoint.toFixed(3),
      cls.count,
      cls.frequency.toFixed(2),
      cls.cumRetained.toFixed(2),
      cls.cumPassing.toFixed(2),
    ].join(','));
  }
  
  return lines.join('\n');
}

/**
 * Generate trend data CSV
 */
export function generateTrendCSV(trendData: TrendDataPoint[]): string {
  const lines: string[] = [];
  
  lines.push('Timestamp,P80 (mm),D50 (mm),D10 (mm),D90 (mm),Count');
  
  for (const point of trendData) {
    lines.push([
      point.timestamp.toISOString(),
      point.p80.toFixed(3),
      point.d50.toFixed(3),
      point.d10.toFixed(3),
      point.d90.toFixed(3),
      point.count,
    ].join(','));
  }
  
  return lines.join('\n');
}

/**
 * Download a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  downloadFile(content, filename, 'text/csv;charset=utf-8;');
}

/**
 * Generate Excel-compatible XML (SpreadsheetML)
 * This creates a multi-sheet workbook without requiring external libraries
 */
export function generateExcelXML(
  results: AnalysisResult[],
  sizeClasses: SizeClass[],
  trendData: TrendDataPoint[]
): string {
  const escapeXML = (str: string): string => 
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#CCCCCC" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Number">
   <NumberFormat ss:Format="0.000"/>
  </Style>
  <Style ss:ID="Date">
   <NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/>
  </Style>
 </Styles>`;

  // Summary Sheet
  xml += `
 <Worksheet ss:Name="Summary">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Timestamp</Data></Cell>
    <Cell><Data ss:Type="String">Count</Data></Cell>
    <Cell><Data ss:Type="String">D10 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">D50 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">D80 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">D90 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">P80 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">F80 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">Reduction Ratio</Data></Cell>
    <Cell><Data ss:Type="String">Mean (mm)</Data></Cell>
    <Cell><Data ss:Type="String">Min (mm)</Data></Cell>
    <Cell><Data ss:Type="String">Max (mm)</Data></Cell>
    <Cell><Data ss:Type="String">CV (%)</Data></Cell>
   </Row>`;

  for (const result of results) {
    const m = result.metrics;
    xml += `
   <Row>
    <Cell ss:StyleID="Date"><Data ss:Type="DateTime">${result.timestamp.toISOString()}</Data></Cell>
    <Cell><Data ss:Type="Number">${m.count}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.d10}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.d50}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.d80}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.d90}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.p80}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.f80}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.reductionRatio}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.mean}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.min}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.max}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${m.cv}</Data></Cell>
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>`;

  // Size Classes Sheet
  xml += `
 <Worksheet ss:Name="Size Distribution">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Size Min (mm)</Data></Cell>
    <Cell><Data ss:Type="String">Size Max (mm)</Data></Cell>
    <Cell><Data ss:Type="String">Midpoint (mm)</Data></Cell>
    <Cell><Data ss:Type="String">Count</Data></Cell>
    <Cell><Data ss:Type="String">Frequency (%)</Data></Cell>
    <Cell><Data ss:Type="String">Cum Retained (%)</Data></Cell>
    <Cell><Data ss:Type="String">Cum Passing (%)</Data></Cell>
   </Row>`;

  for (const cls of sizeClasses) {
    xml += `
   <Row>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${cls.sizeMin}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${cls.sizeMax}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${cls.midpoint}</Data></Cell>
    <Cell><Data ss:Type="Number">${cls.count}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${cls.frequency}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${cls.cumRetained}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${cls.cumPassing}</Data></Cell>
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>`;

  // Trend Sheet
  xml += `
 <Worksheet ss:Name="Trend Data">
  <Table>
   <Row ss:StyleID="Header">
    <Cell><Data ss:Type="String">Timestamp</Data></Cell>
    <Cell><Data ss:Type="String">P80 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">D50 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">D10 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">D90 (mm)</Data></Cell>
    <Cell><Data ss:Type="String">Count</Data></Cell>
   </Row>`;

  for (const point of trendData) {
    xml += `
   <Row>
    <Cell ss:StyleID="Date"><Data ss:Type="DateTime">${point.timestamp.toISOString()}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${point.p80}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${point.d50}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${point.d10}</Data></Cell>
    <Cell ss:StyleID="Number"><Data ss:Type="Number">${point.d90}</Data></Cell>
    <Cell><Data ss:Type="Number">${point.count}</Data></Cell>
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Download Excel file
 */
export function downloadExcel(
  results: AnalysisResult[],
  sizeClasses: SizeClass[],
  trendData: TrendDataPoint[],
  filename: string
): void {
  const xml = generateExcelXML(results, sizeClasses, trendData);
  downloadFile(xml, filename, 'application/vnd.ms-excel');
}

/**
 * Generate PDF report using browser print
 * Returns HTML that can be printed or converted to PDF
 */
export function generatePDFHTML(
  results: AnalysisResult[],
  sizeClasses: SizeClass[],
  metrics: PSDMetrics,
  chartImages: { psd?: string; histogram?: string; trend?: string }
): string {
  const latestResult = results[results.length - 1];
  const timestamp = latestResult?.timestamp || new Date();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>PSD Analysis Report</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { 
      font-family: 'Segoe UI', Arial, sans-serif; 
      margin: 20px; 
      color: #1a1a1a;
      line-height: 1.5;
    }
    h1 { 
      color: #0f4c75; 
      border-bottom: 3px solid #0f4c75; 
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 { 
      color: #1a1a1a; 
      margin-top: 30px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .header-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 20px;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .metrics-grid { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 15px; 
      margin: 20px 0;
    }
    .metric-card { 
      background: #f8f9fa; 
      padding: 15px; 
      border-radius: 8px; 
      text-align: center;
      border: 1px solid #e9ecef;
    }
    .metric-value { 
      font-size: 24px; 
      font-weight: bold; 
      color: #0f4c75;
    }
    .metric-label { 
      color: #6c757d; 
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 20px 0;
      font-size: 12px;
    }
    th, td { 
      border: 1px solid #dee2e6; 
      padding: 10px; 
      text-align: right; 
    }
    th { 
      background: #0f4c75; 
      color: white; 
      font-weight: 600;
    }
    tr:nth-child(even) { background: #f8f9fa; }
    .chart-container { 
      margin: 20px 0; 
      text-align: center;
      page-break-inside: avoid;
    }
    .chart-container img { 
      max-width: 100%; 
      height: auto;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 11px;
      color: #6c757d;
      text-align: center;
    }
    @page { margin: 15mm; }
  </style>
</head>
<body>
  <h1>PSD Analyzer Report</h1>
  <div class="header-info">
    <div><strong>Report:</strong> Particle Size Distribution</div>
    <div><strong>Date:</strong> ${timestamp.toLocaleDateString()}</div>
    <div><strong>Time:</strong> ${timestamp.toLocaleTimeString()}</div>
    <div><strong>Samples:</strong> ${results.length}</div>
    <div><strong>Total Particles:</strong> ${metrics.count}</div>
  </div>

  <h2>Key Metrics</h2>
  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-value">${metrics.p80.toFixed(2)}</div>
      <div class="metric-label">P80 (mm)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.d50.toFixed(2)}</div>
      <div class="metric-label">D50 (mm)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.d10.toFixed(2)}</div>
      <div class="metric-label">D10 (mm)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.d90.toFixed(2)}</div>
      <div class="metric-label">D90 (mm)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.mean.toFixed(2)}</div>
      <div class="metric-label">Mean (mm)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.f80.toFixed(2)}</div>
      <div class="metric-label">F80 (mm)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.reductionRatio.toFixed(2)}</div>
      <div class="metric-label">Reduction Ratio</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.span.toFixed(2)}</div>
      <div class="metric-label">Span</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.min.toFixed(2)} - ${metrics.max.toFixed(2)}</div>
      <div class="metric-label">Min - Max (mm)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${metrics.cv.toFixed(1)}%</div>
      <div class="metric-label">CV</div>
    </div>
  </div>

  ${chartImages.psd ? `
  <h2>Cumulative Passing Curve</h2>
  <div class="chart-container">
    <img src="${chartImages.psd}" alt="PSD Curve" />
  </div>
  ` : ''}

  ${chartImages.histogram ? `
  <h2>Size Distribution Histogram</h2>
  <div class="chart-container">
    <img src="${chartImages.histogram}" alt="Histogram" />
  </div>
  ` : ''}

  ${chartImages.trend ? `
  <h2>Trend Analysis</h2>
  <div class="chart-container">
    <img src="${chartImages.trend}" alt="Trend Chart" />
  </div>
  ` : ''}

  <h2>Size Distribution Data</h2>
  <table>
    <thead>
      <tr>
        <th>Size Min (mm)</th>
        <th>Size Max (mm)</th>
        <th>Count</th>
        <th>Frequency (%)</th>
        <th>Cum Retained (%)</th>
        <th>Cum Passing (%)</th>
      </tr>
    </thead>
    <tbody>
      ${sizeClasses.map(cls => `
      <tr>
        <td>${cls.sizeMin.toFixed(3)}</td>
        <td>${cls.sizeMax.toFixed(3)}</td>
        <td>${cls.count}</td>
        <td>${cls.frequency.toFixed(2)}</td>
        <td>${cls.cumRetained.toFixed(2)}</td>
        <td>${cls.cumPassing.toFixed(2)}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    Generated by PSD Analyzer | ${new Date().toISOString()}
  </div>
</body>
</html>`;
}

/**
 * Open print dialog for PDF generation
 */
export function printPDFReport(
  results: AnalysisResult[],
  sizeClasses: SizeClass[],
  metrics: PSDMetrics,
  chartImages: { psd?: string; histogram?: string; trend?: string }
): void {
  const html = generatePDFHTML(results, sizeClasses, metrics, chartImages);
  const printWindow = window.open('', '_blank');
  
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

/**
 * Capture chart as image data URL
 */
export function captureChartAsImage(chartElement: HTMLElement): Promise<string> {
  return new Promise((resolve, reject) => {
    import('html-to-image').then(({ toPng }) => {
      toPng(chartElement, { quality: 0.95, backgroundColor: '#ffffff' })
        .then(resolve)
        .catch(reject);
    }).catch(() => {
      // Fallback: return empty string if html-to-image not available
      resolve('');
    });
  });
}
