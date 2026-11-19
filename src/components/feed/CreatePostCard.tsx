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
      showToast(`A post can contain up to ${MAX_POST_IMAGES} images.`, 'error');
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
      showToast(`${results.length} media file(s) attached! 📎`);
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

      showToast('Post shared to VORTEX!');
      if (onPostCreated) {
        onPostCreated(newPost);
      }
    } catch {
      showToast('Failed to create post', 'error');
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
      className={`p-4 sm:p-5 rounded-2xl bg-slate-900/70 border shadow-card-dark relative select-none transition-colors ${isDragging ? 'border-violet-500 bg-violet-950/20' : 'border-slate-800/90'}`}
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
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm sm:text-base resize-none outline-none focus:ring-0 border-none p-0 text-start"
          />

          {/* Active Feeling badge */}
          {selectedFeeling && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-600/20 text-violet-300 text-xs font-medium border border-violet-500/30 mb-2">
              <span>{selectedFeeling}</span>
              <button
                onClick={() => setSelectedFeeling(null)}
                className="hover:text-white"
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
            <div className="mt-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Upload images to VORTEX storage:</span>
                <button type="button" onClick={() => setShowImageInput(false)} className="hover:text-slate-200" aria-label="Close image uploader">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:border-violet-500 disabled:opacity-50"
              >
                <UploadCloud className="h-4 w-4" />
                {isUploading ? t('uploadingMedia') : t('uploadMediaFiles')}
              </button>
              {uploadedImages.length > 0 && (
                <div className="flex items-center justify-between gap-2 text-xs text-emerald-400">
                  <span>{uploadedImages.length} {t('filesUploaded')}</span>
                  <button type="button" onClick={() => setUploadedImages([])} className="text-slate-400 hover:text-rose-300">Remove all</button>
                </div>
              )}
            </div>
          )}

          {/* Feelings dropdown */}
          {showFeelingsDropdown && (
            <div className="mt-2 p-2 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
              {FEELINGS.map((feel) => (
                <button
                  key={feel}
                  type="button"
                  onClick={() => {
                    setSelectedFeeling(feel);
                    setShowFeelingsDropdown(false);
                  }}
                  className="px-2 py-1.5 rounded-lg text-start text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                >
                  {feel}
                </button>
              ))}
            </div>
          )}

          {/* Image, feeling, hashtag and publish actions */}
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800/80">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setShowImageInput(!showImageInput)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  showImageInput || uploadedImages.length > 0
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Image className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">{t('photo')}</span>
              </button>



              <button
                type="button"
                onClick={() => setShowFeelingsDropdown(!showFeelingsDropdown)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedFeeling
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Smile className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">{t('feeling')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setContent((prev) => (prev ? `${prev} #Tech #VORTEX` : '#Tech #VORTEX'));
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
                title="Add Tags"
              >
                <Tag className="w-4 h-4 text-violet-400" />
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
