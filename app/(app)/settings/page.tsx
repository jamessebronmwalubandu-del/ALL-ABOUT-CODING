'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalibrationPanel } from '@/app/components/calibration-panel';
import { SettingsPanel } from '@/app/components/settings-panel';
import { Settings as SettingsIcon } from 'lucide-react';
import { useAppStore } from '@/lib/useAppStore';

export default function SettingsPage() {
  const calibrationSettings = useAppStore((state) => state.calibrationSettings);
  const setCalibrationSettings = useAppStore((state) => state.setCalibrationSettings);
  const detectionSettings = useAppStore((state) => state.detectionSettings);
  const setDetectionSettings = useAppStore((state) => state.setDetectionSettings);

  return (
    <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <SettingsIcon className="size-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Calibration and detection parameters
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="calibration" className="w-full flex-1 flex flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="calibration" className="flex-1">
            Calibration
          </TabsTrigger>
          <TabsTrigger value="detection" className="flex-1">
            Detection
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calibration" className="flex-1 mt-4">
          <div className="bg-card/50 rounded-lg border border-border/50 p-6 max-w-2xl">
            <CalibrationPanel
              calibration={calibrationSettings}
              onCalibrationChange={setCalibrationSettings}
            />
          </div>
        </TabsContent>

        <TabsContent value="detection" className="flex-1 mt-4">
          <div className="bg-card/50 rounded-lg border border-border/50 p-6 max-w-2xl">
            <SettingsPanel
              settings={detectionSettings}
              onSettingsChange={setDetectionSettings}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
