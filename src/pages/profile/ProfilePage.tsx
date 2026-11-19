import React, { useState, useEffect } from 'react';
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
      showToast(res.isPending ? t('followRequestSent') : res.isFollowing ? `You followed ${profileUser.name}` : `Unfollowed ${profileUser.name}`);
    } catch {
      showToast('Could not update follow status', 'error');
    }
  };

  const handleStartMessage = async () => {
    if (!profileUser) return;
    try {
      const conv = await messagingService.getOrCreateConversation(profileUser.id);
      navigate(`/messages?conv=${conv.id}`);
    } catch {
      showToast('Could not open messaging', 'error');
    }
  };

  const handleSaveProfile = async () => {
    if (!profileUser) return;
    setIsSaving(true);
    try {
      const updated = await updateUser({
        name: editName,
        bio: editBio,
        location: editLocation,
        website: editWebsite,
        avatar: editAvatar,
        coverImage: editCover,
      });
      setProfileUser(updated);
      setIsEditModalOpen(false);
      showToast('Profile updated successfully!');
    } catch {
      showToast('Failed to save profile changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareProfile = () => {
    navigator.clipboard?.writeText?.(window.location.href);
    showToast('Profile URL copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span>Loading profile...</span>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <EmptyState
        title="User not found"
        description="The account you are looking for does not exist or has been removed."
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
    <div className="flex flex-col min-h-screen">
      {/* Cover Image matching reference image top-right */}
      <div className="relative h-48 sm:h-64 w-full bg-slate-900 overflow-hidden">
        {profileUser.coverImage ? (
          <img
            src={profileUser.coverImage}
            alt="Profile cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-violet-900 to-blue-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/20" />
      </div>

      {/* Profile Header Details matching reference image */}
      <div className="px-5 sm:px-8 pb-5 relative -mt-16 sm:-mt-20 flex flex-col items-center text-center">
        {/* Avatar with glow and verified badge */}
        <div className="relative inline-block mb-3">
          <Avatar
            src={profileUser.avatar}
            alt={profileUser.name}
            size="2xl"
            className="ring-4 ring-slate-950 shadow-2xl"
          />
        </div>

        {/* Name & Username */}
        <div className="flex items-center gap-1.5 justify-center">
          <h1 className="text-xl sm:text-2xl font-black text-white">{profileUser.name}</h1>
          {profileUser.verified && <Badge variant="verified" size="md" />}
        </div>
        <span className="text-xs sm:text-sm text-slate-400 mt-0.5">@{profileUser.username}</span>

        {/* Stats Row matching reference image: 245 Posts, 12.5K Followers, 136 Following */}
        <div className="flex items-center justify-center gap-6 sm:gap-8 my-4 py-2 px-6 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg font-black text-white">{profileUser.postsCount}</span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('posts')}</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg font-black text-white">
              {profileUser.followersCount >= 1000 ? `${(profileUser.followersCount / 1000).toFixed(1)}K` : profileUser.followersCount}
            </span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('followers')}</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg font-black text-white">{profileUser.followingCount}</span>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('following')}</span>
          </div>
        </div>

        {/* Bio */}
        {profileUser.bio && (
          <p className="text-xs sm:text-sm text-slate-200 max-w-lg leading-relaxed font-normal">
            {profileUser.bio}
          </p>
        )}

        {/* Meta tags (location, website, joined date) */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 mt-3">
          {profileUser.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-violet-400" />
              <span>{profileUser.location}</span>
            </div>
          )}
          {profileUser.website && (
            <a
              href={profileUser.website}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-violet-400 hover:underline"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>{profileUser.website.replace('https://', '')}</span>
            </a>
          )}
          <div className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('joined')} {profileUser.joinedDate}</span>
          </div>
        </div>

        {/* Action Buttons matching reference image */}
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
                leftIcon={<Mail className="w-4 h-4 text-violet-400" />}
              >
                {t('messages')}
              </Button>
            </>
          )}

          <button
            onClick={handleShareProfile}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Share profile"
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
              title="No posts yet"
              description={`${profileUser.name} hasn't posted anything yet.`}
            />
          ) : (
            <div className="space-y-4">
              {userPosts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </div>
          )
        )}

        {/* Media 6-grid gallery matching reference image top-right */}
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
                className="group relative h-36 sm:h-44 rounded-xl overflow-hidden bg-slate-900 border border-slate-800"
              >
                <img
                  src={img}
                  alt={`Gallery ${i}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {(activeTab === 'replies' || activeTab === 'likes' || activeTab === 'saved') && (
          <EmptyState
            title={`No ${activeTab} to show`}
            description={`Activity in this tab will show up here as ${profileUser.name} interacts.`}
          />
        )}
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
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
            placeholder="e.g. Cairo, Egypt"
          />
          <Input
            label={t('websiteLabel')}
            value={editWebsite}
            onChange={(e) => setEditWebsite(e.target.value)}
            placeholder="https://yourwebsite.com"
          />
          <Input
            label={t('avatarPhoto')}
            value={editAvatar}
            onChange={(e) => setEditAvatar(e.target.value)}
            placeholder="Image URL"
          />
          <Input
            label={t('coverPhoto')}
            value={editCover}
            onChange={(e) => setEditCover(e.target.value)}
            placeholder="Cover Image URL"
          />
        </div>
      </Modal>
    </div>
  );
};
