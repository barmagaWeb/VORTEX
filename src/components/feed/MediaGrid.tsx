import React from 'react';

interface MediaGridProps {
  images?: string[];
}

export const MediaGrid: React.FC<MediaGridProps> = ({ images = [] }) => {
  if (!images.length) return null;

  return (
    <div className={`grid gap-1.5 rounded-xl overflow-hidden ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {images.map((image, index) => (
        <img
          key={`${image}-${index}`}
          src={image}
          alt={`Post attachment ${index + 1}`}
          loading="lazy"
          className={`w-full object-cover ${images.length === 1 ? 'max-h-[460px]' : 'h-52'}`}
        />
      ))}
    </div>
  );
};
