'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Camera, 
  Globe, 
  Upload, 
  Link2, 
  FolderOpen, 
  Clipboard as ClipboardIcon,
  RefreshCw,
  Play,
  Pause,
  AlertCircle
} from 'lucide-react';
import type { ImageSourceType, ImageSourceConfig } from '../lib/types';
import { 
  getVideoDevices, 
  loadImageFromClipboard,
  SUPPORTED_IMAGE_EXTENSIONS,
  checkBrowserSupport
} from '../lib/image-sources';

interface ImageSourceSelectorProps {
  onSourceChange: (type: ImageSourceType, config: ImageSourceConfig) => void;
  onFileSelect: (files: File[]) => void;
  onPasteImage: (img: HTMLImageElement) => void;
  activeSource: ImageSourceType;
  isStreaming: boolean;
  onToggleStream: () => void;
}

export function ImageSourceSelector({
  onSourceChange,
  onFileSelect,
  onPasteImage,
  activeSource,
  isStreaming,
  onToggleStream,
}: ImageSourceSelectorProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [ipCameraUrl, setIpCameraUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(1000);
  const [browserSupport, setBrowserSupport] = useState({ webcam: true, clipboard: true, fileSystemAccess: false });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBrowserSupport(checkBrowserSupport());
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const videoDevices = await getVideoDevices();
      setDevices(videoDevices);
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId);
      }
      setError(null);
    } catch (err) {
      setError('Camera access denied or not available');
    }
  };

  const handleDeviceChange = (deviceId: string) => {
    setSelectedDevice(deviceId);
    onSourceChange('webcam', { deviceId });
  };

  const handleIpCameraConnect = () => {
    if (!ipCameraUrl) return;
    onSourceChange('ip-camera', { 
      streamUrl: ipCameraUrl,
      refreshInterval 
    });
  };

  const handleUrlConnect = () => {
    if (!imageUrl) return;
    onSourceChange('url', { imageUrl });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(Array.from(files));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileSelect(Array.from(files));
    }
  }, [onFileSelect]);

  const handlePaste = async () => {
    try {
      const img = await loadImageFromClipboard();
      if (img) {
        onPasteImage(img);
      } else {
        setError('No image found in clipboard');
      }
    } catch {
      setError('Failed to read clipboard');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <Tabs 
          value={activeSource} 
          onValueChange={(v) => onSourceChange(v as ImageSourceType, {})}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-6 h-10 mb-4">
            <TabsTrigger value="webcam" className="gap-1.5 text-xs">
              <Camera className="size-3.5" />
              <span className="hidden sm:inline">Webcam</span>
            </TabsTrigger>
            <TabsTrigger value="ip-camera" className="gap-1.5 text-xs">
              <Globe className="size-3.5" />
              <span className="hidden sm:inline">IP Cam</span>
            </TabsTrigger>
            <TabsTrigger value="file-upload" className="gap-1.5 text-xs">
              <Upload className="size-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="url" className="gap-1.5 text-xs">
              <Link2 className="size-3.5" />
              <span className="hidden sm:inline">URL</span>
            </TabsTrigger>
            <TabsTrigger value="folder-watch" className="gap-1.5 text-xs">
              <FolderOpen className="size-3.5" />
              <span className="hidden sm:inline">Folder</span>
            </TabsTrigger>
            <TabsTrigger value="clipboard" className="gap-1.5 text-xs">
              <ClipboardIcon className="size-3.5" />
              <span className="hidden sm:inline">Paste</span>
            </TabsTrigger>
          </TabsList>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-3 p-2 bg-destructive/10 rounded-md">
              <AlertCircle className="size-4" />
              {error}
            </div>
          )}

          <TabsContent value="webcam" className="mt-0">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Camera Device</Label>
                <Select value={selectedDevice} onValueChange={handleDeviceChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select camera..." />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${devices.indexOf(device) + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-5">
                <Button 
                  variant="outline" 
                  size="icon" 
                  onClick={loadDevices}
                  title="Refresh devices"
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button 
                  variant={isStreaming ? "destructive" : "default"}
                  onClick={onToggleStream}
                  className="gap-2"
                >
                  {isStreaming ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {isStreaming ? 'Stop' : 'Start'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ip-camera" className="mt-0">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">
                  Stream URL (MJPEG/Snapshot)
                </Label>
                <Input
                  placeholder="http://192.168.1.100:8080/video"
                  value={ipCameraUrl}
                  onChange={(e) => setIpCameraUrl(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">
                    Refresh Interval (ms)
                  </Label>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 1000)}
                  />
                </div>
                <Button onClick={handleIpCameraConnect} className="gap-2">
                  <Globe className="size-4" />
                  Connect
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file-upload" className="mt-0">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-border/50 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept={SUPPORTED_IMAGE_EXTENSIONS}
                multiple
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop images here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Supports: JPEG, PNG, BMP, TIFF, WebP
                </p>
              </label>
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-0">
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Image URL</Label>
                <Input
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
              <Button onClick={handleUrlConnect} className="gap-2">
                <Link2 className="size-4" />
                Load Image
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="folder-watch" className="mt-0">
            <div className="text-center p-4">
              {browserSupport.fileSystemAccess ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Select a folder to watch for new images
                  </p>
                  <Button variant="outline" className="gap-2">
                    <FolderOpen className="size-4" />
                    Select Folder
                  </Button>
                </div>
              ) : (
                <div className="text-muted-foreground">
                  <AlertCircle className="size-8 mx-auto mb-2" />
                  <p className="text-sm">
                    Folder watch is not supported in this browser.
                  </p>
                  <p className="text-xs mt-1">
                    Use Chrome or Edge for this feature.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="clipboard" className="mt-0">
            <div className="text-center p-4">
              <p className="text-sm text-muted-foreground mb-3">
                Paste an image from your clipboard (Ctrl+V)
              </p>
              <Button onClick={handlePaste} className="gap-2">
                <ClipboardIcon className="size-4" />
                Paste from Clipboard
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
