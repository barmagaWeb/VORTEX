import React, { useEffect, useRef, useState } from 'react';
import { Image, Tag, X, UploadCloud } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { postService } from '../../services';
import { uploadMediaFile } from '../../services/supabase/storage';
import { Post } from '../../types';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: (post: Post) => void;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onPostCreated,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'private'>('public');
  const [tagsInput, setTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clearSelectedImage = () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;
    if (!IMAGE_TYPES.has(file.type)) {
      showToast(t('unsupportedMediaType'), 'error');
      return;
    }
    if (file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
      showToast(t('toastImageTooLarge'), 'error');
      return;
    }

    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (isSubmitting || (!content.trim() && !selectedFile)) return;
    setIsSubmitting(true);
    try {
      let imagePath: string | undefined;
      if (selectedFile) {
        if (!user) throw new Error('Authentication required');
        const uploaded = await uploadMediaFile('post_media', selectedFile, user.id);
        imagePath = uploaded.url;
      }

      const parsedTags = Array.from(new Set(tagsInput
        .split(/\s+/)
        .map((tag) => tag.replace(/^#+/, '').trim().toLowerCase())
        .filter((tag) => /^[\p{L}\p{N}_]{1,64}$/u.test(tag))))
        .slice(0, 30);

      const newPost = await postService.createPost({
        content: content.trim(),
        images: imagePath ? [imagePath] : undefined,
        visibility,
        tags: parsedTags,
      });

      setContent('');
      clearSelectedImage();
      setTagsInput('');
      setVisibility('public');
      onClose();
      showToast(t('postPublished'));
      onPostCreated?.(newPost);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('mediaUploadFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('createPost')}
      maxWidth="lg"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || (!content.trim() && !selectedFile)}
          >
            {t('post')}
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar src={user?.avatar} alt={user?.name || 'User'} size="md" />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-fg"><bdi>{user?.name}</bdi></span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <select
                value={visibility}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'public' || value === 'followers' || value === 'private') setVisibility(value);
                }}
                className="bg-surface text-fg-muted text-xs rounded-lg px-2 py-0.5 border border-border outline-none cursor-pointer"
              >
                <option value="public">🌐 {t('public')}</option>
                <option value="followers">👥 {t('followersOnly')}</option>
                <option value="private">🔒 {t('private')}</option>
              </select>
            </div>
          </div>
        </div>

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value.slice(0, 10000))}
          placeholder={t('whatsOnYourMind')}
          rows={4}
          maxLength={10000}
          dir="auto"
          className="w-full bg-surface-elevated/50 rounded-xl p-3.5 text-fg placeholder:text-fg-subtle text-sm border border-border outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 resize-none transition-all"
        />
        <div className="flex justify-end text-[11px] text-fg-subtle">{content.length}/10000</div>

        <div className="flex items-center gap-2 bg-surface px-3 py-2 rounded-xl border border-border">
          <Tag className="w-4 h-4 text-primary shrink-0" />
          <input
            type="text"
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value.slice(0, 1000))}
            placeholder={t('addTagsPlaceholder')}
            maxLength={1000}
            className="w-full bg-transparent text-xs text-fg placeholder:text-fg-subtle outline-none"
          />
        </div>

        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-fg-muted flex items-center gap-1.5">
            <Image className="w-4 h-4 text-blue-500" />
            <span>{t('photo')}</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-fg hover:border-primary disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4 text-primary" />
            {t('uploadMediaFiles')}
          </button>
          <p className="text-[11px] text-fg-subtle">{t('imageUploadHint')}</p>

          {previewUrl && (
            <div className="relative rounded-xl overflow-hidden max-h-48 bg-surface-elevated border border-border mt-2">
              <img src={previewUrl} alt={t('selectedImagePreview')} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearSelectedImage}
                disabled={isSubmitting}
                className="absolute top-2 end-2 p-1.5 rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-50"
                aria-label={t('removeSelectedImage')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
