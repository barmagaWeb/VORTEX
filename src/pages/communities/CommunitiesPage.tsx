import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Plus, Compass, Check } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { communityService } from '../../services';
import { Community } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';

export const CommunitiesPage: React.FC = () => {
  const { t } = useLanguage();
  const { showToast } = useToast();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  // Create community modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Technology');
  const [rules, setRules] = useState('1. Be respectful\n2. Share quality content');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    'All',
    'Technology',
    'Design & Art',
    'Photography',
    'Science & Future',
  ];

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const data = await communityService.getCommunities(
        selectedCategory === 'All' ? undefined : selectedCategory
      );
      setCommunities(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [selectedCategory]);

  const handleToggleMembership = async (e: React.MouseEvent, comm: Community) => {
    e.preventDefault();
    try {
      const res = await communityService.toggleMembership(comm.id);
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === comm.id ? { ...c, isMember: res.isMember, memberCount: res.memberCount } : c
        )
      );
      showToast(res.isMember ? t('toastJoinedCommunity', { name: comm.name }) : t('toastLeftCommunity', { name: comm.name }));
    } catch {
      showToast(t('toastMembershipFailed'), 'error');
    }
  };

  const handleCreateCommunity = async () => {
    if (!name.trim() || !description.trim()) return;
    setIsSubmitting(true);
    try {
      const newComm = await communityService.createCommunity({
        name: name.trim(),
        description: description.trim(),
        category,
        rules: rules.split('\n').filter(Boolean),
      });
      setCommunities([newComm, ...communities]);
      setIsCreateModalOpen(false);
      setName('');
      setDescription('');
      showToast(t('toastCommunityCreated', { name: newComm.name }));
    } catch {
      showToast(t('toastCommunityCreateFailed'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-surface/85 backdrop-blur-md border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-black text-fg">{t('communities')}</h1>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
          >
            {t('createCommunity')}
          </Button>
        </div>

        {/* Categories scrollable bar */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors min-h-[32px] ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'bg-surface text-fg-muted hover:text-fg border border-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Communities Grid */}
      <div className="p-4 sm:p-6 space-y-4">
        {loading ? (
          <div className="text-xs text-fg-subtle text-center py-8">{t('loadingCommunities')}</div>
        ) : communities.length === 0 ? (
          <EmptyState
            icon={<Compass className="w-6 h-6" />}
            title={t('noCommunitiesFound')}
            description={t('noCommunitiesHint')}
            action={
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
              >
                {t('createCommunity')}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {communities.map((comm) => (
              <div
                key={comm.id}
                className="group rounded-2xl bg-surface border border-border hover:border-primary/40 transition-all overflow-hidden flex flex-col justify-between shadow-card"
              >
                {/* Banner & Header */}
                <div>
                  <div className="h-24 w-full bg-surface-elevated relative overflow-hidden">
                    <img
                      src={comm.coverImage}
                      alt={comm.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                  </div>

                  <div className="p-4 pt-0 relative -mt-8">
                    <Avatar
                      src={comm.avatar}
                      alt={comm.name}
                      size="lg"
                      className="ring-4 ring-surface mb-2 shadow-card"
                    />
                    <Link
                      to={`/communities/${comm.slug}`}
                      className="font-bold text-sm text-fg group-hover:text-primary-text transition-colors block truncate"
                    >
                      <bdi>{comm.name}</bdi>
                    </Link>
                    <span className="text-[11px] text-fg-subtle block mt-0.5">
                      {comm.memberCount.toLocaleString()} {t('membersCount')} · {comm.category}
                    </span>
                    <p className="text-xs text-fg-muted mt-2 line-clamp-2 leading-relaxed" dir="auto">
                      {comm.description}
                    </p>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="p-4 pt-0 flex items-center justify-between gap-2">
                  <Link to={`/communities/${comm.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" fullWidth className="text-xs">
                      {t('view')}
                    </Button>
                  </Link>

                  <Button
                    onClick={(e) => handleToggleMembership(e, comm)}
                    variant={comm.isMember ? 'secondary' : 'primary'}
                    size="sm"
                    className="text-xs px-4"
                  >
                    {comm.isMember ? (
                      <span className="flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('leaveCommunity')}</span>
                      </span>
                    ) : (
                      t('joinCommunity')
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={t('createCommunity')}
        maxWidth="md"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateCommunity}
              isLoading={isSubmitting}
              disabled={!name.trim() || !description.trim()}
            >
              {t('create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('communityName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('communityNamePlaceholder')}
            required
          />

          <div className="space-y-1.5 text-start">
            <label className="text-xs font-semibold text-fg-muted">{t('communityCategory')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface text-fg text-sm rounded-xl px-3.5 py-2.5 border border-border outline-none focus:border-primary"
            >
              <option value="Technology">{t('technology')}</option>
              <option value="Design & Art">{t('design')}</option>
              <option value="Photography">{t('photography')}</option>
              <option value="Science & Future">{t('science')}</option>
            </select>
          </div>

          <Textarea
            label={t('communityDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('communityDescriptionPlaceholder')}
            rows={3}
            required
          />

          <Textarea
            label={t('communityRulesLabel')}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
};
