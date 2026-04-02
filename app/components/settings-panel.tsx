'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings, RotateCcw } from 'lucide-react';
import type { DetectionSettings } from '../lib/types';
import { DEFAULT_DETECTION_SETTINGS } from '../lib/types';

interface SettingsPanelProps {
  settings: DetectionSettings;
  onSettingsChange: (settings: DetectionSettings) => void;
}

export function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps) {
  const handleChange = <K extends keyof DetectionSettings>(
    key: K,
    value: DetectionSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const handleReset = () => {
    onSettingsChange(DEFAULT_DETECTION_SETTINGS);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="size-4" />
              Detection Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Adjust particle detection parameters
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Threshold Mode */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Adaptive Threshold</Label>
            <p className="text-xs text-muted-foreground">
              Better for uneven lighting
            </p>
          </div>
          <Switch
            checked={settings.useAdaptiveThreshold}
            onCheckedChange={(v) => handleChange('useAdaptiveThreshold', v)}
          />
        </div>

        {/* Invert Image */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Invert Image</Label>
            <p className="text-xs text-muted-foreground">
              For dark particles on light background
            </p>
          </div>
          <Switch
            checked={settings.invertImage}
            onCheckedChange={(v) => handleChange('invertImage', v)}
          />
        </div>

        {/* Fixed Threshold (only when not using adaptive) */}
        {!settings.useAdaptiveThreshold && (
          <div>
            <div className="flex justify-between mb-2">
              <Label className="text-sm">Threshold</Label>
              <span className="text-xs text-muted-foreground font-mono">
                {settings.threshold}
              </span>
            </div>
            <Slider
              value={[settings.threshold]}
              onValueChange={([v]) => handleChange('threshold', v)}
              min={0}
              max={255}
              step={1}
            />
          </div>
        )}

        {/* Adaptive Threshold Settings */}
        {settings.useAdaptiveThreshold && (
          <>
            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-sm">Block Size</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  {settings.adaptiveBlockSize}
                </span>
              </div>
              <Slider
                value={[settings.adaptiveBlockSize]}
                onValueChange={([v]) => handleChange('adaptiveBlockSize', v % 2 === 0 ? v + 1 : v)}
                min={3}
                max={51}
                step={2}
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-sm">Constant (C)</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  {settings.adaptiveC}
                </span>
              </div>
              <Slider
                value={[settings.adaptiveC]}
                onValueChange={([v]) => handleChange('adaptiveC', v)}
                min={-10}
                max={20}
                step={1}
              />
            </div>
          </>
        )}

        {/* Blur */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-sm">Blur Kernel</Label>
            <span className="text-xs text-muted-foreground font-mono">
              {settings.blurKernel}px
            </span>
          </div>
          <Slider
            value={[settings.blurKernel]}
            onValueChange={([v]) => handleChange('blurKernel', v % 2 === 0 ? v + 1 : v)}
            min={1}
            max={15}
            step={2}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Noise reduction (higher = more blur)
          </p>
        </div>

        {/* Morphology Kernel */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-sm">Morphology Kernel</Label>
            <span className="text-xs text-muted-foreground font-mono">
              {settings.morphKernel}px
            </span>
          </div>
          <Slider
            value={[settings.morphKernel]}
            onValueChange={([v]) => handleChange('morphKernel', v % 2 === 0 ? v + 1 : v)}
            min={1}
            max={11}
            step={2}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Hole filling and noise removal
          </p>
        </div>

        {/* Min Particle Size */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-sm">Min Particle Size</Label>
            <span className="text-xs text-muted-foreground font-mono">
              {settings.minParticleSize} px
            </span>
          </div>
          <Slider
            value={[settings.minParticleSize]}
            onValueChange={([v]) => handleChange('minParticleSize', v)}
            min={10}
            max={1000}
            step={10}
          />
        </div>

        {/* Max Particle Size */}
        <div>
          <div className="flex justify-between mb-2">
            <Label className="text-sm">Max Particle Size</Label>
            <span className="text-xs text-muted-foreground font-mono">
              {settings.maxParticleSize.toLocaleString()} px
            </span>
          </div>
          <Slider
            value={[Math.log10(settings.maxParticleSize)]}
            onValueChange={([v]) => handleChange('maxParticleSize', Math.round(Math.pow(10, v)))}
            min={3}
            max={6}
            step={0.1}
          />
        </div>
      </CardContent>
    </Card>
  );
}
