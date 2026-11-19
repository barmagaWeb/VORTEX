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
      showToast('Only JPG, PNG, WEBP and GIF images are supported.', 'error');
      return;
    }
    if (file.size <= 0 || file.size > MAX_STORY_IMAGE_SIZE) {
      showToast('Story images must be smaller than 10 MB.', 'error');
      return;
    }
    if (!user) {
      showToast('Please sign in before uploading a story.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await uploadMediaFile('story_media', file, user.id);
      setMediaPath(uploaded.url);
      setPreviewUrl(URL.createObjectURL(file));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Image upload failed', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mediaPath) {
      showToast('Please select a photo first.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await storiesService.createStory({
        mediaUrl: mediaPath,
        mediaType: 'image',
        caption: caption.trim() || undefined,
      });
      showToast('Story posted successfully!');
      onStoryCreated(created);
      onClose();
      setMediaPath('');
      setPreviewUrl('');
      setCaption('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to post story', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('createStory')} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <span className="text-xs font-semibold text-slate-300">{t('photo')}</span>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => void handleFileUpload(event)} />
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-5 text-xs font-semibold text-slate-200 hover:border-violet-500 disabled:opacity-50">
            <UploadCloud className="h-4 w-4 text-violet-400" />
            {isUploading ? t('uploadingMedia') : 'Choose an image'}
          </button>
        </div>

        {previewUrl && (
          <div className="relative flex max-h-64 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
            <img src={previewUrl} alt="Story preview" className="max-h-60 w-auto rounded-xl object-contain" />
            <button type="button" onClick={() => { setMediaPath(''); setPreviewUrl(''); }} className="absolute top-2 end-2 rounded-full bg-black/70 p-1.5 text-white hover:bg-black" aria-label="Remove selected photo">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">{t('storyCaption')}</label>
          <textarea placeholder={t('uploadStoryPrompt')} value={caption} onChange={(event) => setCaption(event.target.value)} rows={2} maxLength={500} className="w-full resize-none rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100 outline-none focus:border-violet-500" />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800/80 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={!mediaPath || isUploading} leftIcon={<Sparkles className="h-4 w-4" />}>{t('post')}</Button>
        </div>
      </form>
    </Modal>
  );
};
