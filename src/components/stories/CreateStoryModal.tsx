import React, { useEffect, useRef, useState } from 'react';
import { X, Sparkles, UploadCloud } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { storiesService } from '../../services';
import { uploadMediaFile } from '../../services/supabase/storage';
import { Story } from '../../types';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated: (story: Story) => void;
}

const MAX_STORY_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ isOpen, onClose, onStoryCreated }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mediaPath, setMediaPath] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) {
      showToast(t('toastImageTypesOnly'), 'error');
      return;
    }
    if (file.size <= 0 || file.size > MAX_STORY_IMAGE_SIZE) {
      showToast(t('toastStoryTooLarge'), 'error');
      return;
    }
    if (!user) {
      showToast(t('toastSignInToUploadStory'), 'error');
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadMediaFile('story_media', file, user.id);
      setMediaPath(uploaded.url);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('toastImageUploadFailed'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mediaPath) {
      showToast(t('toastSelectPhotoFirst'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await storiesService.createStory({
        mediaUrl: mediaPath,
        mediaType: 'image',
        caption: caption.trim() || undefined,
      });
      showToast(t('toastStoryPosted'));
      onStoryCreated(created);
      onClose();
      setMediaPath('');
      setPreviewUrl('');
      setCaption('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('toastStoryPostFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('createStory')} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs font-semibold text-fg-muted">{t('photo')}</span>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => void handleFileUpload(event)} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-elevated/50 px-4 py-5 text-xs font-semibold text-fg hover:border-primary disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4 text-primary" />
            {isUploading ? t('uploadingMedia') : t('chooseImage')}
          </button>
        </div>

        {previewUrl && (
          <div className="space-y-2">
            {/* Live 9:16 preview: exactly how the photo and caption will sit inside the story */}
            <div className="relative mx-auto aspect-[9/16] max-h-[52dvh] overflow-hidden rounded-2xl border border-border bg-black shadow-lg">
              <img src={previewUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
              <img src={previewUrl} alt={t('storyPreviewAlt')} className="absolute inset-0 h-full w-full object-contain" />
              <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 pb-6 pt-3">
                <div className="h-[3px] w-full rounded-full bg-white/30"><div className="h-full w-1/3 rounded-full bg-white" /></div>
                <div className="mt-2.5 flex items-center gap-2">
                  <img src={user?.avatar} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-white/30" />
                  <span className="truncate text-xs font-semibold text-white"><bdi>{user?.name}</bdi></span>
                </div>
              </div>
              {caption.trim() && (
                <p dir="auto" className="pointer-events-none absolute inset-x-0 bottom-0 line-clamp-4 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-4 pb-4 pt-12 text-center text-xs font-medium leading-relaxed text-white [overflow-wrap:anywhere]">
                  {caption}
                </p>
              )}
              <button
                type="button"
                onClick={() => { setMediaPath(''); setPreviewUrl(''); }}
                className="absolute top-2 end-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
                aria-label={t('removeSelectedImage')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-center text-[11px] text-fg-muted">{t('storyPreviewHint')}</p>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-fg-muted">{t('storyCaption')}</label>
          <textarea
            placeholder={t('uploadStoryPrompt')}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            rows={2}
            maxLength={500}
            dir="auto"
            className="w-full resize-none rounded-xl border border-border bg-surface p-3 text-xs text-fg outline-none focus:border-primary placeholder:text-fg-subtle"
          />
          <p className="text-end text-[11px] text-fg-subtle" aria-hidden="true">{caption.length}/500</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={!mediaPath || isUploading} leftIcon={<Sparkles className="h-4 w-4" />}>{t('post')}</Button>
        </div>
      </form>
    </Modal>
  );
};
