"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  setImages: (files: File[]) => void;
}

export default function ImageUploader({ setImages }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFiles = (files: FileList | null) => {
    if (files && files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        toast({
          title: "Invalid File Type",
          description: "Please upload image files only.",
          variant: "destructive",
        });
        return;
      }
      setImages(imageFiles);
      toast({
        title: "Images Uploaded",
        description: `${imageFiles.length} image(s) have been loaded.`,
      });
    }
  };

  const onDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors duration-200",
        isDragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
      )}
      onClick={onBrowseClick}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        multiple
        accept="image/*"
        onChange={(e: ChangeEvent<HTMLInputElement>) => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <UploadCloud className="w-10 h-10 text-primary" />
        <p className="font-semibold text-foreground">Drag & drop photos here</p>
        <p className="text-xs">or</p>
        <Button type="button" variant="outline" size="sm" className="pointer-events-none rounded-full">
          Browse Files
        </Button>
      </div>
    </div>
  );
}
