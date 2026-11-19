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
      showToast(res.isMember ? `Joined ${comm.name}! 🎉` : `Left ${comm.name}`);
    } catch {
      showToast('Could not update membership', 'error');
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
      showToast(`Created community "${newComm.name}"!`);
    } catch {
      showToast('Failed to create community', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <h1 className="text-lg font-black text-white">{t('communities')}</h1>
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
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
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
          <div className="text-xs text-slate-500 text-center py-8">Loading communities...</div>
        ) : communities.length === 0 ? (
          <EmptyState
            icon={<Compass className="w-6 h-6" />}
            title={t('noCommunitiesFound')}
            description="Be the first pioneer to create a community in this category!"
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
                className="group rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-violet-500/40 transition-all overflow-hidden flex flex-col justify-between shadow-card-dark"
              >
                {/* Banner & Header */}
                <div>
                  <div className="h-24 w-full bg-slate-800 relative overflow-hidden">
                    <img
                      src={comm.coverImage}
                      alt={comm.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                  </div>

                  <div className="p-4 pt-0 relative -mt-8">
                    <Avatar
                      src={comm.avatar}
                      alt={comm.name}
                      size="lg"
                      className="ring-4 ring-slate-900 mb-2 shadow-lg"
                    />
                    <Link
                      to={`/communities/${comm.slug}`}
                      className="font-bold text-sm text-white group-hover:text-violet-300 transition-colors block truncate"
                    >
                      {comm.name}
                    </Link>
                    <span className="text-[11px] text-slate-400 block mt-0.5">
                      {comm.memberCount.toLocaleString()} {t('membersCount')} · {comm.category}
                    </span>
                    <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                      {comm.description}
                    </p>
                  </div>
                </div>

                {/* Card footer actions */}
                <div className="p-4 pt-0 flex items-center justify-between gap-2">
                  <Link to={`/communities/${comm.slug}`} className="flex-1">
                    <Button variant="outline" size="sm" fullWidth className="text-xs">
                      View
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
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('communityName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. NextGen Web Architects"
            required
          />

          <div className="space-y-1.5 text-start">
            <label className="text-xs font-semibold text-slate-300">{t('communityCategory')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 text-slate-100 text-sm rounded-xl px-3.5 py-2.5 border border-slate-700 outline-none focus:border-violet-500"
            >
              <option value="Technology">Technology</option>
              <option value="Design & Art">Design & Art</option>
              <option value="Photography">Photography</option>
              <option value="Science & Future">Science & Future</option>
            </select>
          </div>

          <Textarea
            label={t('communityDescription')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this community about? Who should join?"
            rows={3}
            required
          />

          <Textarea
            label="Community Rules (One per line)"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
};
