import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface MediaGridProps {
  images?: string[];
}

export const MediaGrid: React.FC<MediaGridProps> = ({ images = [] }) => {
  const { t } = useLanguage();
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());

  if (!images.length) return null;

  const validImages = images
    .map((img, idx) => ({ img, idx }))
    .filter(({ idx }) => !failedIndices.has(idx));

  if (!validImages.length) return null;

  return (
    <div className={`grid gap-1.5 rounded-xl overflow-hidden mt-2.5 border border-border/40 ${validImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
      {validImages.map(({ img, idx }) => (
        <img
          key={`${img}-${idx}`}
          src={img}
          alt={t('postAttachmentAlt', { index: idx + 1 })}
          loading="lazy"
          onError={() => {
            setFailedIndices((prev) => new Set(prev).add(idx));
          }}
          className={`w-full object-cover transition-transform hover:scale-[1.01] ${validImages.length === 1 ? 'max-h-[460px]' : 'h-52'}`}
        />
      ))}
    </div>
  );
};
