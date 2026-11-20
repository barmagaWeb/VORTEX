import React, { useState, useRef } from 'react';
import { Image, Smile, Tag, Send, X, UploadCloud } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { postService } from '../../services';
import { uploadMediaFile } from '../../services/supabase/storage';
import { Post } from '../../types';

interface CreatePostCardProps {
  onPostCreated?: (post: Post) => void;
  communityId?: string;
  communityName?: string;
}

const MAX_POST_IMAGES = 10;

const FEELINGS = [
  '✨ feeling inspired',
  '🚀 feeling productive',
  '🎨 feeling creative',
  '☕ drinking coffee',
  '🏔️ feeling peaceful',
  '⚡ feeling energized',
];

export const CreatePostCard: React.FC<CreatePostCardProps> = ({
  onPostCreated,
  communityId,
  communityName,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [content, setContent] = useState('');
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [showFeelingsDropdown, setShowFeelingsDropdown] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [showImageInput, setShowImageInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const acceptedByType = Array.from(files).filter((file) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
    );
    const remaining = Math.max(0, MAX_POST_IMAGES - uploadedImages.length);
    const acceptedFiles = acceptedByType.slice(0, remaining);
    if (acceptedByType.length > remaining) {
      showToast(t('toastMaxPostImages', { max: MAX_POST_IMAGES }), 'error');
    }
    if (acceptedFiles.length !== files.length) {
      showToast(t('unsupportedMediaType'), 'error');
    }
    if (acceptedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const uploadPromises = acceptedFiles.map((file) =>
        uploadMediaFile('post_media', file, user?.id)
      );
      const results = await Promise.all(uploadPromises);
      const newUrls = results.map((r) => r.url);
      setUploadedImages((prev) => [...prev, ...newUrls]);
      showToast(t('toastMediaAttached', { count: results.length }));
    } catch {
      showToast(t('mediaUploadFailed'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const allImages = [...uploadedImages];
    if (!content.trim() && allImages.length === 0) return;

    setIsSubmitting(true);
    try {
      const newPost = await postService.createPost({
        content: content.trim(),
        images: allImages.length > 0 ? allImages : undefined,
        feeling: selectedFeeling || undefined,
        communityId,
        communityName,
        visibility: 'public',
      });

      setContent('');
      setUploadedImages([]);
      setSelectedFeeling(null);
      setShowImageInput(false);
      setShowFeelingsDropdown(false);

      showToast(t('toastPostShared'));
      if (onPostCreated) {
        onPostCreated(newPost);
      }
    } catch {
      showToast(t('toastPostCreateFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
      }}
      onDrop={handleDrop}
      className={`p-4 sm:p-5 rounded-2xl bg-surface border shadow-card relative select-none transition-colors ${
        isDragging ? 'border-primary bg-primary/10' : 'border-border'
      }`}
    >
      <div className="flex gap-3">
        <Avatar src={user?.avatar} alt={user?.name || 'User'} size="md" />

        <div className="flex-1">
          <textarea
            value={content}
            maxLength={10000}
            onChange={(e) => setContent(e.target.value.slice(0, 10000))}
            placeholder={t('whatsOnYourMind')}
            rows={2}
            className="w-full bg-transparent text-fg placeholder:text-fg-subtle text-sm sm:text-base resize-none outline-none focus:ring-0 border-none p-0 text-start"
            dir="auto"
          />

          {/* Active Feeling badge */}
          {selectedFeeling && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 text-primary-text text-xs font-medium border border-primary/30 mb-2">
              <span>{selectedFeeling}</span>
              <button
                onClick={() => setSelectedFeeling(null)}
                className="hover:text-fg"
                aria-label={t('removeFeeling')}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleFileUpload(event.target.files);
              event.target.value = '';
            }}
          />

          {showImageInput && (
            <div className="mt-2 p-3 rounded-xl bg-surface-elevated border border-border space-y-2">
              <div className="flex items-center justify-between text-xs text-fg-muted">
                <span>{t('uploadImagesPrompt')}</span>
                <button
                  type="button"
                  onClick={() => setShowImageInput(false)}
                  className="hover:text-fg p-1"
                  aria-label={t('closeImageUploader')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold text-fg hover:border-primary disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4 text-primary" />
                {isUploading ? t('uploadingMedia') : t('uploadMediaFiles')}
              </button>
              {uploadedImages.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <span>{uploadedImages.length} {t('filesUploaded')}</span>
                  <button type="button" onClick={() => setUploadedImages([])} className="text-fg-muted hover:text-danger">
                    {t('removeAll')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Feelings dropdown */}
          {showFeelingsDropdown && (
            <div className="mt-2 p-2 rounded-xl bg-surface-elevated border border-border shadow-card grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
              {FEELINGS.map((feel) => (
                <button
                  key={feel}
                  type="button"
                  onClick={() => {
                    setSelectedFeeling(feel);
                    setShowFeelingsDropdown(false);
                  }}
                  className="px-2 py-1.5 rounded-lg text-start text-fg-muted hover:bg-surface-hover hover:text-fg transition-colors"
                >
                  {feel}
                </button>
              ))}
            </div>
          )}

          {/* Image, feeling, hashtag and publish actions */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowImageInput(!showImageInput)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                  showImageInput || uploadedImages.length > 0
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                    : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
                }`}
              >
                <Image className="w-4 h-4 text-emerald-500" />
                <span className="hidden sm:inline">{t('photo')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowFeelingsDropdown(!showFeelingsDropdown)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                  selectedFeeling
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-fg-muted hover:text-fg hover:bg-surface-hover'
                }`}
              >
                <Smile className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">{t('feeling')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContent((prev) => (prev ? `${prev} #Tech #VORTEX` : '#Tech #VORTEX'));
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-h-[36px]"
                title={t('addTags')}
              >
                <Tag className="w-4 h-4 text-primary" />
                <span className="hidden sm:inline">{t('tags')}</span>
              </button>
            </div>

            <Button
              onClick={handleSubmit}
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting || isUploading || (!content.trim() && uploadedImages.length === 0)}
              rightIcon={<Send className="w-3.5 h-3.5 rtl:rotate-180" />}
              className="px-5 font-semibold shadow-vortex-glow"
            >
              {t('post')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
