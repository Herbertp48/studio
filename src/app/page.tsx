"use client";

import { useState, useEffect } from "react";
import AppHeader from "@/components/app/header";
import ImageUploader from "@/components/app/image-uploader";
import PreviewControls from "@/components/app/preview-controls";
import ImageGrid from "@/components/app/image-grid";
import { PlaceHolderImages } from '@/lib/placeholder-images';

type PreviewDevice = "desktop" | "tablet" | "mobile";

export default function Home() {
  const [images, setImages] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");

  useEffect(() => {
    setImageUrls(PlaceHolderImages.map(p => p.imageUrl));
  }, []);

  useEffect(() => {
    if (images.length > 0) {
      const urls = images.map(file => URL.createObjectURL(file));
      setImageUrls(urls);
      
      return () => {
        urls.forEach(url => URL.revokeObjectURL(url));
      };
    } else {
      const placeholderUrls = PlaceHolderImages.map(p => p.imageUrl);
      if (JSON.stringify(imageUrls) !== JSON.stringify(placeholderUrls)) {
        setImageUrls(placeholderUrls);
      }
    }
  }, [images, imageUrls]);

  const handleClearImages = () => {
    setImages([]);
  };

  const containerWidthClass = {
    desktop: "w-full",
    tablet: "w-[768px]",
    mobile: "w-[375px]",
  }[previewDevice];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
          <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0">
            <div className="sticky top-8 space-y-6">
              <ImageUploader setImages={setImages} />
              <PreviewControls
                images={images}
                onDeviceChange={setPreviewDevice}
                onClear={handleClearImages}
                activeDevice={previewDevice}
              />
            </div>
          </aside>
          <div className="flex-grow flex justify-center lg:items-start min-w-0">
            <div className={`transition-all duration-500 ease-in-out mx-auto ${containerWidthClass}`}>
              <div className="border rounded-xl shadow-lg p-2 bg-card/50">
                <ImageGrid imageUrls={imageUrls} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
