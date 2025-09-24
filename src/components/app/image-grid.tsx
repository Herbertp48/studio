import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ImageGridProps {
  imageUrls: string[];
}

export default function ImageGrid({ imageUrls }: ImageGridProps) {
  if (imageUrls.length === 0) {
    return (
      <div className="aspect-video flex items-center justify-center text-muted-foreground">
        <p>Envie imagens para começar seu mostruário.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {imageUrls.map((url, index) => (
        <div
          key={url + index}
          className={cn(
            'relative aspect-[4/3] overflow-hidden rounded-lg shadow-sm transition-all duration-300 hover:shadow-xl hover:scale-105',
            // Spanning logic for a more interesting layout
            index === 0 ? 'col-span-2 row-span-2' : '',
            index === 5 ? 'md:col-span-2' : ''
          )}
        >
          <Image
            src={url}
            alt={`Imagem enviada ${index + 1}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            data-ai-hint="showcase image"
          />
        </div>
      ))}
    </div>
  );
}
