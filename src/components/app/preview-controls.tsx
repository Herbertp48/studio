"use client";

import { useState, useTransition } from 'react';
import { Monitor, Tablet, Smartphone, Download, Share2, Palette, Trash2, Loader2, Wand2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from '@/hooks/use-toast';
import { generateThemeAction } from '@/app/actions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PreviewDevice = "desktop" | "tablet" | "mobile";

interface PreviewControlsProps {
  images: File[];
  onDeviceChange: (device: PreviewDevice) => void;
  onClear: () => void;
  activeDevice: PreviewDevice;
}

type Theme = { primaryColor: string; backgroundColor: string; accentColor: string; };

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

function hexToHsl(hex: string): string {
    hex = hex.replace(/^#/, '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h=0, s=0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default function PreviewControls({ images, onDeviceChange, onClear, activeDevice }: PreviewControlsProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [suggestedTheme, setSuggestedTheme] = useState<Theme | null>(null);

  const handleThemeGeneration = () => {
    if (images.length === 0) {
      toast({ title: "No Images Uploaded", description: "Please upload images to generate a theme.", variant: "destructive" });
      return;
    }
    startTransition(async () => {
      try {
        const photoDataUris = await Promise.all(images.map(fileToBase64));
        const result = await generateThemeAction({ photoDataUris });
        setSuggestedTheme(result.theme);
        toast({ title: "Theme Suggested!", description: "A new theme has been generated from your images." });
      } catch (error) {
        toast({ title: "Theme Generation Failed", description: "Could not generate a theme. Please try again.", variant: "destructive" });
      }
    });
  };

  const applyTheme = (theme: Theme) => {
    document.documentElement.style.setProperty('--background', hexToHsl(theme.backgroundColor));
    document.documentElement.style.setProperty('--primary', hexToHsl(theme.primaryColor));
    document.documentElement.style.setProperty('--accent', hexToHsl(theme.accentColor));
  };
  
  const resetTheme = () => {
    document.documentElement.style.removeProperty('--background');
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--accent');
    setSuggestedTheme(null);
    toast({ title: "Theme Reset", description: "The theme has been reset to default." });
  };
  
  const handleActionClick = (action: string) => {
    toast({
      title: "Feature Not Implemented",
      description: `${action} functionality is not yet available.`,
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette />Theme</CardTitle>
            <CardDescription>Generate a custom color theme from your photos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleThemeGeneration} disabled={isPending || images.length === 0} className="w-full">
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Suggest Theme
            </Button>
            {suggestedTheme && (
              <div className="space-y-2 pt-2">
                 <div className="flex items-center justify-between">
                   <p className="text-sm font-medium">Suggested Colors:</p>
                   <Button variant="ghost" size="sm" onClick={resetTheme}>Reset</Button>
                 </div>
                 <div className="flex justify-around p-2 rounded-lg bg-muted/50">
                    {[
                      { label: 'Background', color: suggestedTheme.backgroundColor },
                      { label: 'Primary', color: suggestedTheme.primaryColor },
                      { label: 'Accent', color: suggestedTheme.accentColor }
                    ].map(item => (
                       <Tooltip key={item.label}>
                         <TooltipTrigger asChild>
                           <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={() => applyTheme(suggestedTheme)}>
                            <div className="w-8 h-8 rounded-full border-2" style={{ backgroundColor: item.color }}/>
                           </div>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>{item.label}: {item.color}</p>
                         </TooltipContent>
                       </Tooltip>
                    ))}
                 </div>
                 <Button className="w-full" onClick={() => applyTheme(suggestedTheme)}>Apply Theme</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Monitor />Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <ToggleGroup type="single" value={activeDevice} onValueChange={(value) => value && onDeviceChange(value as PreviewDevice)} className="w-full" aria-label="Device Preview">
              <ToggleGroupItem value="desktop" aria-label="Desktop preview" className="w-full"><Monitor className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="tablet" aria-label="Tablet preview" className="w-full"><Tablet className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="mobile" aria-label="Mobile preview" className="w-full"><Smartphone className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Info />Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" />Download</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleActionClick('PDF Download')}>Download as PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleActionClick('ZIP Download')}>Download as .zip</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => handleActionClick('Share')}><Share2 className="mr-2 h-4 w-4" />Share</Button>
            <Button variant="destructive" onClick={onClear} className="col-span-2" disabled={images.length === 0}><Trash2 className="mr-2 h-4 w-4" />Clear</Button>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
