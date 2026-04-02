'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Ruler, CircleDot, Check, Info } from 'lucide-react';
import type { CalibrationSettings } from '../lib/types';
import { 
  REFERENCE_OBJECTS, 
  type ReferenceObjectKey,
  createManualCalibration,
  createReferenceCalibration,
  validateCalibration,
  formatCalibrationInfo
} from '../lib/calibration';

interface CalibrationPanelProps {
  calibration: CalibrationSettings;
  onCalibrationChange: (calibration: CalibrationSettings) => void;
}

export function CalibrationPanel({ calibration, onCalibrationChange }: CalibrationPanelProps) {
  const [method, setMethod] = useState<'manual' | 'reference'>(calibration.method);
  const [manualPixelsPerMm, setManualPixelsPerMm] = useState(calibration.pixelsPerMm.toString());
  const [selectedReference, setSelectedReference] = useState<ReferenceObjectKey>('ruler-1cm');
  const [customSize, setCustomSize] = useState('10');
  const [measuredPixels, setMeasuredPixels] = useState('100');
  const [isCalibrating, setIsCalibrating] = useState(false);

  const handleManualApply = () => {
    const pixelsPerMm = parseFloat(manualPixelsPerMm);
    if (pixelsPerMm > 0) {
      const newCalibration = createManualCalibration(pixelsPerMm);
      const validation = validateCalibration(newCalibration);
      if (validation.valid) {
        onCalibrationChange(newCalibration);
      }
    }
  };

  const handleReferenceApply = () => {
    const pixels = parseFloat(measuredPixels);
    const size = selectedReference === 'custom' 
      ? parseFloat(customSize) 
      : REFERENCE_OBJECTS[selectedReference].size;
    
    if (pixels > 0 && size > 0) {
      const newCalibration = createReferenceCalibration(pixels, size);
      const validation = validateCalibration(newCalibration);
      if (validation.valid) {
        onCalibrationChange(newCalibration);
      }
    }
  };

  const validation = validateCalibration(calibration);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Ruler className="size-4" />
          Scale Calibration
        </CardTitle>
        <CardDescription className="text-xs">
          Set the pixel-to-millimeter conversion for accurate measurements
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current calibration status */}
        <div className="p-3 bg-secondary/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Current Calibration</span>
            {validation.valid ? (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <Check className="size-3" /> Valid
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <Info className="size-3" /> Invalid
              </span>
            )}
          </div>
          <div className="text-sm font-mono">
            {calibration.pixelsPerMm.toFixed(2)} px/mm
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            1 pixel = {(1 / calibration.pixelsPerMm).toFixed(4)} mm
          </div>
        </div>

        <Tabs value={method} onValueChange={(v) => setMethod(v as 'manual' | 'reference')}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="manual" className="text-xs gap-1.5">
              <Ruler className="size-3.5" />
              Manual
            </TabsTrigger>
            <TabsTrigger value="reference" className="text-xs gap-1.5">
              <CircleDot className="size-3.5" />
              Reference Object
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="mt-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Pixels per Millimeter
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={manualPixelsPerMm}
                  onChange={(e) => setManualPixelsPerMm(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleManualApply} size="sm">
                  Apply
                </Button>
              </div>
            </div>
            
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Quick Adjust
              </Label>
              <Slider
                value={[parseFloat(manualPixelsPerMm) || 10]}
                onValueChange={([v]) => setManualPixelsPerMm(v.toString())}
                min={1}
                max={100}
                step={0.5}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>1 px/mm</span>
                <span>100 px/mm</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              <strong>Tip:</strong> If you know your camera distance and sensor specs, 
              calculate px/mm as: (Image Width in px) / (Field of View in mm)
            </div>
          </TabsContent>

          <TabsContent value="reference" className="mt-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Reference Object
              </Label>
              <Select value={selectedReference} onValueChange={(v) => setSelectedReference(v as ReferenceObjectKey)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REFERENCE_OBJECTS).map(([key, { name, size }]) => (
                    <SelectItem key={key} value={key}>
                      {name} {size > 0 ? `(${size}mm)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedReference === 'custom' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Custom Size (mm)
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value)}
                />
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Measured Size in Pixels
              </Label>
              <Input
                type="number"
                min="1"
                value={measuredPixels}
                onChange={(e) => setMeasuredPixels(e.target.value)}
                placeholder="Measure the reference object in the image"
              />
            </div>

            <Button onClick={handleReferenceApply} className="w-full" size="sm">
              <Check className="size-4 mr-2" />
              Apply Calibration
            </Button>

            <div className="text-xs text-muted-foreground p-2 bg-muted/50 rounded">
              <strong>Instructions:</strong>
              <ol className="list-decimal list-inside mt-1 space-y-1">
                <li>Place the reference object in the camera view</li>
                <li>Measure its width/diameter in pixels using the image</li>
                <li>Enter the pixel measurement above</li>
                <li>Click Apply to calibrate</li>
              </ol>
            </div>
          </TabsContent>
        </Tabs>

        {validation.warnings.length > 0 && (
          <div className="text-xs text-yellow-500 p-2 bg-yellow-500/10 rounded flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5" />
            <div>
              {validation.warnings.map((warning, i) => (
                <div key={i}>{warning}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
