import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Link as LinkIcon,
  Calendar,
  Edit3,
  Share2,
  Mail,
  UserPlus,
  UserCheck,
  Camera,
  X,
} from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { PostCard } from '../../components/feed/PostCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { userService, postService, messagingService } from '../../services';
import { User, Post } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { uploadMediaFile } from '../../services/supabase/storage';

export const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: currentUser, updateUser } = useAuth();
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'media' | 'likes' | 'saved'>('posts');
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [editCover, setEditCover] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const targetUsername = username || currentUser?.username || 'ahmedmohamed';
  const isOwnProfile = currentUser?.username === profileUser?.username;

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const u = await userService.getUserByUsername(targetUsername);
        if (u) {
          setProfileUser(u);
          const posts = await postService.getUserPosts(u.id);
          setUserPosts(posts);

          // Populate edit form defaults
          setEditName(u.name);
          setEditBio(u.bio || '');
          setEditLocation(u.location || '');
          setEditWebsite(u.website || '');
          setEditAvatar(u.avatar);
          setEditCover(u.coverImage || '');
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [targetUsername]);

  const handleToggleFollow = async () => {
    if (!profileUser) return;
    try {
      const res = await userService.toggleFollow(profileUser.id);
      setProfileUser({
        ...profileUser,
        isFollowing: res.isFollowing,
        isFollowPending: Boolean(res.isPending),
        followersCount: res.newFollowersCount,
      });
      showToast(res.isPending ? t('followRequestSent') : res.isFollowing ? t('toastFollowed', { name: profileUser.name }) : t('toastUnfollowed', { name: profileUser.name }));
    } catch {
      showToast(t('toastFollowFailed'), 'error');
    }
  };

  const handleStartMessage = async () => {
    if (!profileUser) return;
    try {
      const conv = await messagingService.getOrCreateConversation(profileUser.id);
      navigate(`/messages?conv=${conv.id}`);
    } catch {
      showToast(t('toastOpenMessagingFailed'), 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!profileUser) return;
    setIsSaving(true);
    try {
      let avatarUrl = editAvatar;
      if (avatarFile) {
        if (!currentUser?.id) throw new Error('You must be signed in to upload a profile photo.');
        const uploaded = await uploadMediaFile('avatars', avatarFile, currentUser.id);
        avatarUrl = uploaded.url;
      }
      const updated = await updateUser({
        name: editName,
        bio: editBio,
        location: editLocation,
        website: editWebsite,
        avatar: avatarUrl,
        coverImage: editCover,
      });
      setProfileUser(updated);
      setEditAvatar(updated.avatar || '');
      setAvatarFile(null);
      setAvatarPreview('');
      setIsEditModalOpen(false);
      showToast(t('toastProfileUpdated'));
    } catch {
      showToast(t('toastProfileSaveFailed'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareProfile = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    showToast(t('toastProfileLinkCopied'));
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-fg-subtle">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span>{t('loadingProfile')}</span>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <EmptyState
        title={t('userNotFound')}
        description={t('userNotFoundDescription')}
        className="m-6"
      />
    );
  }

  const profileTabs = [
    { id: 'posts', label: t('posts'), count: profileUser.postsCount },
    { id: 'replies', label: t('replies') },
    { id: 'media', label: t('media') },
    { id: 'likes', label: t('likes') },
    ...(isOwnProfile ? [{ id: 'saved', label: t('saved') }] : []),
  ];

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Cover Image */}
      <div className="relative h-48 sm:h-64 w-full bg-surface-elevated overflow-hidden">
        {profileUser.coverImage ? (
          <img
            src={profileUser.coverImage}
            alt={t('profileCoverAlt')}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-violet-600/30 to-blue-600/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-black/20" />
      </div>

      {/* Profile Header Details */}
      <div className="px-5 sm:px-8 pb-5 relative -mt-16 sm:-mt-20 flex flex-col items-center text-center">
        {/* Avatar with ring */}
        <div className="relative inline-block mb-3">
          <Avatar
            src={profileUser.avatar}
            alt={profileUser.name}
            size="2xl"
            className="ring-4 ring-bg shadow-2xl"
          />
        </div>

        {/* Name & Username */}
        <div className="flex items-center gap-1.5 justify-center">
          <h1 className="text-xl sm:text-2xl font-black text-fg">
            <bdi>{profileUser.name}</bdi>
          </h1>
          {profileUser.verified && <Badge variant="verified" size="md" />}
        </div>
        <span className="text-xs sm:text-sm text-fg-muted mt-0.5" dir="ltr">@{profileUser.username}</span>

        {/* Stats Row */}
        <div className="flex items-center justify-center gap-6 sm:gap-8 my-4 py-2 px-6 rounded-2xl bg-surface border border-border shadow-card">
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg font-black text-fg">{profileUser.postsCount}</span>
            <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">{t('posts')}</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg font-black text-fg">
              {profileUser.followersCount >= 1000 ? `${(profileUser.followersCount / 1000).toFixed(1)}K` : profileUser.followersCount}
            </span>
            <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">{t('followers')}</span>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg font-black text-fg">{profileUser.followingCount}</span>
            <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">{t('following')}</span>
          </div>
        </div>

        {/* Bio */}
        {profileUser.bio && (
          <p className="text-xs sm:text-sm text-fg max-w-lg leading-relaxed font-normal" dir="auto">
            {profileUser.bio}
          </p>
        )}

        {/* Meta tags (location, website, joined date) */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-fg-muted mt-3">
          {profileUser.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>{profileUser.location}</span>
            </div>
          )}
          {profileUser.website && (
            <a
              href={profileUser.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-primary-text hover:underline"
              dir="ltr"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>{profileUser.website.replace('https://', '')}</span>
            </a>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-fg-subtle" />
            <span>{t('joined')} {profileUser.joinedDate}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-5">
          {isOwnProfile ? (
            <Button
              onClick={() => setIsEditModalOpen(true)}
              variant="secondary"
              size="md"
              leftIcon={<Edit3 className="w-4 h-4" />}
            >
              {t('editProfile')}
            </Button>
          ) : (
            <>
              <Button
                onClick={handleToggleFollow}
                variant={profileUser.isFollowing || profileUser.isFollowPending ? 'secondary' : 'primary'}
                size="md"
                leftIcon={profileUser.isFollowing || profileUser.isFollowPending ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              >
                {profileUser.isFollowPending ? t('requested') : profileUser.isFollowing ? t('unfollow') : t('follow')}
              </Button>
              <Button
                onClick={handleStartMessage}
                variant="outline"
                size="md"
                leftIcon={<Mail className="w-4 h-4 text-primary" />}
              >
                {t('messages')}
              </Button>
            </>
          )}

          <button
            onClick={handleShareProfile}
            className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-hover border border-border text-fg-muted hover:text-fg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title={t('shareProfile')}
            aria-label={t('shareProfile')}
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs
        tabs={profileTabs}
        activeTab={activeTab}
        onChange={(tab) => {
          if (tab === 'posts' || tab === 'replies' || tab === 'media' || tab === 'likes' || tab === 'saved') setActiveTab(tab);
        }}
        className="px-4"
      />

      {/* Tab Panels */}
      <div className="p-4 sm:p-6 space-y-4">
        {activeTab === 'posts' && (
          userPosts.length === 0 ? (
            <EmptyState
              title={t('noPostsYet')}
              description={t('noPostsYetDescription', { name: profileUser.name })}
            />
          ) : (
            <div className="space-y-4">
              {userPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )
        )}

        {/* Media 6-grid gallery */}
        {activeTab === 'media' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
              'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=600&q=80',
            ].map((img, i) => (
              <div
                key={i}
                className="group relative h-36 sm:h-44 rounded-xl overflow-hidden bg-surface border border-border"
              >
                <img
                  src={img}
                  alt={t('galleryImageAlt', { index: i + 1 })}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'replies' || activeTab === 'likes' || activeTab === 'saved') && (
          <EmptyState
            title={t('nothingInTab', { tab: t(activeTab) })}
            description={t('tabActivityHint', { name: profileUser.name })}
          />
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setAvatarFile(null); setAvatarPreview(''); }}
        title={t('editProfile')}
        maxWidth="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)} disabled={isSaving}>
              {t('cancel')}
            </Button>
            <Button variant="primary" onClick={handleSaveProfile} isLoading={isSaving}>
              {t('saveChanges')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('displayName')}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <Textarea
            label={t('bioLabel')}
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            rows={3}
          />
          <Input
            label={t('locationLabel')}
            value={editLocation}
            onChange={(e) => setEditLocation(e.target.value)}
            placeholder={t('locationPlaceholder')}
          />
          <Input
            label={t('websiteLabel')}
            value={editWebsite}
            onChange={(e) => setEditWebsite(e.target.value)}
            placeholder="https://yourwebsite.com"
          />
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-fg">{t('avatarPhoto')}</label>
            <div className="flex items-center gap-4">
              <Avatar src={avatarPreview || editAvatar} alt={editName || 'Profile'} size="2xl" />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      showToast('Profile photo must be 5 MB or smaller.', 'error');
                      event.target.value = '';
                      return;
                    }
                    setAvatarFile(file);
                    setAvatarPreview(URL.createObjectURL(file));
                  }}
                />
                <Button variant="secondary" onClick={() => avatarInputRef.current?.click()} leftIcon={<Camera className="w-4 h-4" />}>
                  {t('avatarPhoto')}
                </Button>
                {(avatarFile || editAvatar) && (
                  <Button variant="ghost" onClick={() => { setAvatarFile(null); setAvatarPreview(''); setEditAvatar(''); if (avatarInputRef.current) avatarInputRef.current.value = ''; }} leftIcon={<X className="w-4 h-4" />}>
                    {t('remove')}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-fg-muted">JPG, PNG, WebP or GIF · 5 MB max</p>
          </div>
          <Input
            label={t('coverPhoto')}
            value={editCover}
            onChange={(e) => setEditCover(e.target.value)}
            placeholder={t('coverImageUrlPlaceholder')}
          />
        </div>
      </Modal>
    </div>
  );
};
