import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, Image, Smile, CheckCheck, Users, X, ArrowLeft } from 'lucide-react';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { messagingService, userService, isSupabaseConfigured } from '../../services';
import { uploadMediaFile } from '../../services/supabase/storage';
import { Conversation, Message, User } from '../../types';
import { ConversationMember } from '../../services/interfaces/IMessagingService';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export const MessagesPage: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const targetConvId = searchParams.get('conv');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<string[]>([]);
  const [pendingAttachmentPreviews, setPendingAttachmentPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<User[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState<ConversationMember[]>([]);
  const [manageGroupName, setManageGroupName] = useState('');
  const [manageMemberQuery, setManageMemberQuery] = useState('');
  const [manageMemberResults, setManageMemberResults] = useState<User[]>([]);
  const [isGroupUpdating, setIsGroupUpdating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pendingPreviewRef = useRef<string[]>([]);
  const loadedMessageIds = useRef<Set<string>>(new Set());
  pendingPreviewRef.current = pendingAttachmentPreviews;

  useEffect(() => () => {
    pendingPreviewRef.current.forEach((preview) => URL.revokeObjectURL(preview));
  }, []);

  const refreshConversations = useCallback(async () => {
    const result = await messagingService.getConversations();
    setConversations(result);
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const convs = await messagingService.getConversations();
        if (!active) return;
        setConversations(convs);
        if (convs.length) {
          const target = targetConvId ? convs.find((conversation) => conversation.id === targetConvId) : undefined;
          setActiveConv(target || convs[0]);
        } else {
          setActiveConv(null);
        }
      } catch {
        if (active) showToast(t('toastConversationsLoadFailed'), 'error');
      }
    };
    void load();
    return () => { active = false; };
  }, [targetConvId, showToast]);

  useEffect(() => {
    if (!activeConv) {
      setMessages([]);
      return;
    }
    let active = true;
    loadedMessageIds.current = new Set();
    const loadMessages = async () => {
      try {
        const result = await messagingService.getMessages(activeConv.id);
        if (!active) return;
        const nextIds = new Set(result.map((message) => message.id));
        const hasChanged = nextIds.size !== loadedMessageIds.current.size
          || result.some((message) => !loadedMessageIds.current.has(message.id));
        if (!hasChanged) return;
        loadedMessageIds.current = nextIds;
        setMessages(result);
        await messagingService.markConversationAsRead(activeConv.id);
        await refreshConversations();
      } catch {
        if (active) showToast(t('toastMessagesLoadFailed'), 'error');
      }
    };
    void loadMessages();

    const unsubscribe = messagingService.subscribeToMessages(activeConv.id, (message) => {
      loadedMessageIds.current.add(message.id);
      setMessages((current) => current.some((item) => item.id === message.id)
        ? current
        : [...current, message]);
      if (message.senderId !== user?.id) void messagingService.markConversationAsRead(activeConv.id);
      void refreshConversations();
    });

    const interval = window.setInterval(() => { void loadMessages(); }, isSupabaseConfigured() ? 30000 : 5000);
    return () => {
      active = false;
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [activeConv?.id, refreshConversations, showToast, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let active = true;
    if (memberQuery.trim().length < 2) {
      setMemberResults([]);
      return () => { active = false; };
    }
    const timer = window.setTimeout(async () => {
      try {
        const results = await userService.searchUsers(memberQuery.trim());
        if (active) {
          setMemberResults(results.filter((candidate) => candidate.id !== user?.id));
        }
      } catch {
        if (active) setMemberResults([]);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [memberQuery, user?.id]);

  useEffect(() => {
    let active = true;
    if (!showManageGroupModal || manageMemberQuery.trim().length < 2) {
      setManageMemberResults([]);
      return () => { active = false; };
    }
    const timer = window.setTimeout(async () => {
      try {
        const results = await userService.searchUsers(manageMemberQuery.trim());
        if (active) {
          const existingIds = new Set(groupMembers.map((member) => member.user.id));
          setManageMemberResults(results.filter((candidate) => candidate.id !== user?.id && !existingIds.has(candidate.id)));
        }
      } catch {
        if (active) setManageMemberResults([]);
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [showManageGroupModal, manageMemberQuery, groupMembers, user?.id]);

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSending || (!inputMessage.trim() && pendingAttachments.length === 0) || !activeConv) return;
    const text = inputMessage.trim();
    const attachments = [...pendingAttachments];
    const previews = [...pendingAttachmentPreviews];
    const temporaryId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage: Message = {
      id: temporaryId,
      senderId: user?.id || '',
      conversationId: activeConv.id,
      content: text,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: true,
      attachments: previews,
    };

    setInputMessage('');
    setPendingAttachments([]);
    setPendingAttachmentPreviews([]);
    setMessages((current) => [...current, optimisticMessage]);
    setIsSending(true);

    try {
      const sent = await messagingService.sendMessage(activeConv.id, text, attachments);
      setMessages((current) => {
        const withoutTemporary = current.filter((item) => item.id !== temporaryId);
        return withoutTemporary.some((item) => item.id === sent.id) ? withoutTemporary : [...withoutTemporary, sent];
      });
      previews.forEach((preview) => URL.revokeObjectURL(preview));
      void refreshConversations().catch((error: unknown) => console.error('Unable to refresh conversation list', error));
    } catch {
      setMessages((current) => current.filter((item) => item.id !== temporaryId));
      setInputMessage(text);
      setPendingAttachments(attachments);
      setPendingAttachmentPreviews(previews);
      showToast(t('toastMessageSendFailed'), 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || !activeConv || !user) return;
    const remaining = 4 - pendingAttachments.length;
    if (remaining <= 0) {
      showToast(t('toastMaxMessageImages'), 'error');
      return;
    }
    const accepted = files.filter((file) => IMAGE_TYPES.has(file.type)).slice(0, remaining);
    if (accepted.length !== files.length) showToast(t('toastImageTypesOnly'), 'error');
    if (!accepted.length) return;

    setIsUploading(true);
    const previews = accepted.map((file) => URL.createObjectURL(file));
    try {
      const uploads = await Promise.all(accepted.map((file) =>
        uploadMediaFile('attachments', file, `${user.id}/${activeConv.id}`)
      ));
      setPendingAttachments((current) => [...current, ...uploads.map((upload) => isSupabaseConfigured() ? upload.path : upload.url)].slice(0, 4));
      setPendingAttachmentPreviews((current) => [...current, ...previews].slice(0, 4));
    } catch {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
      showToast(t('toastImageUploadFailed'), 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    setIsCreatingGroup(true);
    try {
      const created = await messagingService.createGroupConversation(
        groupName.trim(),
        selectedMembers.map((member) => member.id)
      );
      const convs = await refreshConversations();
      setActiveConv(convs.find((conversation) => conversation.id === created.id) || created);
      setShowGroupModal(false);
      setGroupName('');
      setMemberQuery('');
      setSelectedMembers([]);
      showToast(t('groupCreated'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('errCreateGroupFailed'), 'error');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const openManageGroup = async () => {
    if (!activeConv?.isGroup) return;
    setManageGroupName(activeConv.groupName || activeConv.participant.name);
    setIsGroupUpdating(true);
    try {
      const members = await messagingService.getConversationMembers(activeConv.id);
      setGroupMembers(members);
      setShowManageGroupModal(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('errLoadGroupMembersFailed'), 'error');
    } finally {
      setIsGroupUpdating(false);
    }
  };

  const reloadGroupMembers = async () => {
    if (!activeConv) return;
    const members = await messagingService.getConversationMembers(activeConv.id);
    setGroupMembers(members);
  };

  const handleRenameGroup = async () => {
    if (!activeConv || !manageGroupName.trim()) return;
    setIsGroupUpdating(true);
    try {
      await messagingService.renameGroup(activeConv.id, manageGroupName.trim());
      const convs = await refreshConversations();
      setActiveConv(convs.find((item) => item.id === activeConv.id) || { ...activeConv, groupName: manageGroupName.trim() });
      showToast(t('groupRenamed'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('errRenameGroupFailed'), 'error');
    } finally {
      setIsGroupUpdating(false);
    }
  };

  const handleAddGroupMember = async (member: User) => {
    if (!activeConv) return;
    setIsGroupUpdating(true);
    try {
      await messagingService.addGroupMember(activeConv.id, member.id);
      await reloadGroupMembers();
      setManageMemberQuery('');
      setManageMemberResults([]);
      showToast(t('memberAdded'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('errAddMemberFailed'), 'error');
    } finally {
      setIsGroupUpdating(false);
    }
  };

  const handleRemoveGroupMember = async (memberId: string) => {
    if (!activeConv) return;
    setIsGroupUpdating(true);
    try {
      await messagingService.removeGroupMember(activeConv.id, memberId);
      await reloadGroupMembers();
      showToast(t('memberRemoved'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('errRemoveMemberFailed'), 'error');
    } finally {
      setIsGroupUpdating(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeConv || activeConv.ownerId === user?.id) return;
    setIsGroupUpdating(true);
    try {
      await messagingService.leaveGroup(activeConv.id);
      setShowManageGroupModal(false);
      setActiveConv(null);
      await refreshConversations();
      showToast(t('groupLeft'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('errLeaveGroupFailed'), 'error');
    } finally {
      setIsGroupUpdating(false);
    }
  };

  const filteredConversations = conversations.filter((conversation) =>
    conversation.participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.participant.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conversation.groupName && conversation.groupName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] bg-bg overflow-hidden text-fg">
      {/* Conversations List Panel */}
      <div className={`w-full md:w-80 lg:w-96 border-e border-border flex flex-col bg-surface/50 ${activeConv ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-black text-fg">{t('messages')}</h1>
            <button
              type="button"
              onClick={() => setShowGroupModal(true)}
              disabled={!isSupabaseConfigured()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary-text hover:bg-primary/20 disabled:opacity-40 transition-colors"
              title={!isSupabaseConfigured() ? t('connectSupabaseForGroups') : t('createGroup')}
            >
              <Users className="h-4 w-4" />
              <span>{t('newGroup')}</span>
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-fg-subtle absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchConversations')}
              className="w-full bg-surface text-fg placeholder:text-fg-subtle text-xs rounded-full ps-9 pe-4 py-2 border border-border focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {filteredConversations.map((conversation) => {
            const isSelected = activeConv?.id === conversation.id;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConv(conversation)}
                className={`w-full text-start p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-primary/10 border-s-4 border-primary' : 'hover:bg-surface-hover'
                }`}
              >
                <Avatar src={conversation.participant.avatar} alt={conversation.groupName || conversation.participant.name} size="md" isOnline={conversation.isOnline} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-fg truncate"><bdi>{conversation.groupName || conversation.participant.name}</bdi></span>
                    <span className="text-[10px] text-fg-subtle">{conversation.lastMessage?.createdAt}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-fg-muted truncate max-w-[180px]">{conversation.isTyping ? 'Typing…' : conversation.lastMessage?.content}</span>
                    {conversation.unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary text-primary-fg">{conversation.unreadCount}</span>}
                  </span>
                </span>
              </button>
            );
          })}
          {filteredConversations.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-fg-subtle">{t('noConversationsFound')}</p>
          )}
        </div>
      </div>

      {/* Active Conversation Thread Panel */}
      {activeConv ? (
        <div className="flex-1 flex flex-col bg-surface/30 h-full min-w-0">
          <div className="p-3.5 sm:px-6 border-b border-border bg-surface/85 backdrop-blur-md flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveConv(null)}
              className="md:hidden p-1.5 rounded-lg text-fg-muted hover:text-fg min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label={t('backToConversations')}
            >
              <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            </button>
            <Avatar src={activeConv.participant.avatar} alt={activeConv.groupName || activeConv.participant.name} size="md" isOnline={activeConv.isOnline} />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-fg truncate"><bdi>{activeConv.groupName || activeConv.participant.name}</bdi></span>
              <span className="text-[11px] text-fg-subtle">{activeConv.isGroup ? t('groupConversation') : `@${activeConv.participant.username}`}</span>
            </div>
            {activeConv.isGroup && (
              <button
                type="button"
                onClick={() => void openManageGroup()}
                disabled={isGroupUpdating}
                className="ms-auto rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-fg hover:border-primary disabled:opacity-50 transition-colors"
              >
                {t('manageGroup')}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((message) => {
              const isMine = message.senderId === user?.id || (!user && message.senderId === 'usr_me');
              return (
                <div key={message.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {!isMine && <Avatar src={activeConv.participant.avatar} alt={activeConv.participant.name} size="xs" />}
                  <div className={`max-w-[82%] sm:max-w-md rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-sm ${
                    isMine
                      ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-ee-none'
                      : 'bg-surface-elevated text-fg rounded-es-none border border-border'
                  }`}>
                    {message.content && <p className="break-words whitespace-pre-wrap" dir="auto">{message.content}</p>}
                    {!!message.attachments?.length && (
                      <div className={`grid gap-1.5 ${message.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${message.content ? 'mt-2' : ''}`}>
                        {message.attachments.map((attachment, index) => (
                          <img key={`${message.id}-${index}`} src={attachment} alt={t('messageAttachmentAlt')} loading="lazy" className="max-h-64 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMine ? 'text-violet-200' : 'text-fg-subtle'}`}>
                      <span>{message.createdAt}</span>
                      {isMine && <CheckCheck className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {pendingAttachments.length > 0 && (
            <div className="px-4 pt-3 flex gap-2 flex-wrap border-t border-border">
              {pendingAttachments.map((attachment, index) => (
                <div key={`${attachment.slice(0, 32)}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border">
                  <img src={pendingAttachmentPreviews[index] || ''} alt={t('pendingAttachmentAlt')} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => {
                    const preview = pendingAttachmentPreviews[index];
                    if (preview) URL.revokeObjectURL(preview);
                    setPendingAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index));
                    setPendingAttachmentPreviews((current) => current.filter((_, itemIndex) => itemIndex !== index));
                  }} className="absolute top-0.5 end-0.5 rounded-full bg-black/70 p-0.5 text-white" aria-label={t('removeImage')}><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-surface border-t border-border flex items-center gap-2">
            <input ref={attachmentInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event) => void handleAttachmentUpload(event)} />
            <button
              type="button"
              onClick={() => setInputMessage((previous) => `${previous} 😊`)}
              className="p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label={t('addEmoji')}
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={isUploading || isSending || pendingAttachments.length >= 4}
              className="p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors disabled:opacity-40 min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label={t('attachImages')}
            >
              <Image className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              placeholder={t('typeMessage')}
              maxLength={5000}
              disabled={isSending}
              dir="auto"
              className="flex-1 min-w-0 bg-surface-elevated text-fg placeholder:text-fg-subtle text-xs sm:text-sm rounded-xl px-4 py-2.5 border border-border focus:border-primary outline-none transition-all"
            />
            <button
              type="submit"
              disabled={(!inputMessage.trim() && pendingAttachments.length === 0) || isUploading || isSending}
              className="p-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 shadow-md shadow-violet-600/30 transition-all active:scale-95 min-w-[40px] min-h-[40px] flex items-center justify-center"
              aria-label={t('sendMessage')}
            >
              <Send className="w-4 h-4 rtl:rotate-180" />
            </button>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center p-6 text-fg-subtle text-sm">{t('selectConversation')}</div>
      )}

      {/* New Group Modal */}
      <Modal isOpen={showGroupModal} onClose={() => setShowGroupModal(false)} title={t('createGroup')} maxWidth="lg" footer={
        <>
          <Button variant="ghost" onClick={() => setShowGroupModal(false)}>{t('cancel')}</Button>
          <Button variant="primary" isLoading={isCreatingGroup} disabled={!groupName.trim() || selectedMembers.length === 0} onClick={() => void createGroup()}>
            {t('createGroup')}
          </Button>
        </>
      }>
        <form onSubmit={(event) => { event.preventDefault(); void createGroup(); }} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-fg-muted">{t('groupName')}</span>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} required className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary placeholder:text-fg-subtle" placeholder={t('groupName')} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-fg-muted">{t('addPeople')}</span>
            <input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary placeholder:text-fg-subtle" placeholder={t('searchPeople')} />
          </label>
          {selectedMembers.length > 0 && <div className="flex flex-wrap gap-2">{selectedMembers.map((member) => <button type="button" key={member.id} onClick={() => setSelectedMembers((current) => current.filter((item) => item.id !== member.id))} className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-3 py-1.5 text-xs text-primary-text">@{member.username}<X className="h-3 w-3" /></button>)}</div>}
          <div className="max-h-52 overflow-y-auto divide-y divide-border rounded-xl border border-border">
            {memberResults.map((member) => {
              const selected = selectedMembers.some((item) => item.id === member.id);
              return <button type="button" key={member.id} onClick={() => setSelectedMembers((current) => selected ? current.filter((item) => item.id !== member.id) : [...current, member])} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-surface-hover transition-colors"><Avatar src={member.avatar} alt={member.name} size="sm" /><span className="flex-1 min-w-0"><span className="block truncate text-xs font-semibold text-fg"><bdi>{member.name}</bdi></span><span className="block truncate text-[11px] text-fg-subtle" dir="ltr">@{member.username}</span></span><span className={`text-xs font-bold ${selected ? 'text-primary-text' : 'text-fg-subtle'}`}>{selected ? t('selected') : t('add')}</span></button>;
            })}
            {memberQuery.trim().length >= 2 && memberResults.length === 0 && <p className="px-3 py-5 text-center text-xs text-fg-subtle">{t('noPeopleFound')}</p>}
          </div>
          <p className="text-[11px] text-fg-subtle">{t('groupCreatedNotice')}</p>
        </form>
      </Modal>

      {/* Manage Group Modal */}
      <Modal isOpen={showManageGroupModal} onClose={() => setShowManageGroupModal(false)} title={t('manageGroup')} maxWidth="lg" footer={
        <>
          {activeConv?.ownerId !== user?.id && <Button variant="ghost" onClick={() => void handleLeaveGroup()} disabled={isGroupUpdating}>{t('leaveGroup')}</Button>}
          <Button variant="ghost" onClick={() => setShowManageGroupModal(false)}>{t('cancel')}</Button>
        </>
      }>
        <div className="space-y-5">
          {groupMembers.some((member) => member.user.id === user?.id && member.role === 'admin') ? (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-fg-muted">{t('renameGroup')}</label>
                <div className="flex gap-2">
                  <input value={manageGroupName} onChange={(event) => setManageGroupName(event.target.value)} maxLength={80} className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary placeholder:text-fg-subtle" />
                  <Button variant="primary" onClick={() => void handleRenameGroup()} isLoading={isGroupUpdating} disabled={!manageGroupName.trim()}>{t('saveChanges')}</Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-fg-muted">{t('addPeople')}</label>
                <input value={manageMemberQuery} onChange={(event) => setManageMemberQuery(event.target.value)} placeholder={t('searchPeople')} className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-fg outline-none focus:border-primary placeholder:text-fg-subtle" />
                {manageMemberResults.length > 0 && <div className="max-h-36 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                  {manageMemberResults.map((member) => <button key={member.id} type="button" disabled={isGroupUpdating} onClick={() => void handleAddGroupMember(member)} className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-surface-hover disabled:opacity-50 transition-colors"><Avatar src={member.avatar} alt={member.name} size="xs" /><span className="flex-1 truncate text-xs text-fg">{member.name} <span className="text-fg-subtle">@{member.username}</span></span><span className="text-xs text-primary-text">{t('add')}</span></button>)}
                </div>}
              </div>
            </>
          ) : <p className="text-xs text-fg-subtle">{t('groupAdminOnly')}</p>}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-fg-muted">{t('groupMembers')} ({groupMembers.length})</h4>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-border divide-y divide-border">
              {groupMembers.map((member) => <div key={member.user.id} className="flex items-center gap-2 px-3 py-2.5">
                <Avatar src={member.user.avatar} alt={member.user.name} size="xs" />
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-fg"><bdi>{member.user.name}</bdi></span><span className="block truncate text-[11px] text-fg-subtle" dir="ltr">@{member.user.username}</span></span>
                {member.role === 'admin' && <span className="text-[10px] text-primary-text">{t('groupAdminLabel')}</span>}
                {groupMembers.some((item) => item.user.id === user?.id && item.role === 'admin') && member.user.id !== user?.id && member.user.id !== activeConv?.ownerId && <button type="button" disabled={isGroupUpdating} onClick={() => void handleRemoveGroupMember(member.user.id)} className="rounded-lg px-2 py-1 text-[10px] text-danger-text hover:bg-danger/10 disabled:opacity-50 transition-colors">{t('removeMember')}</button>}
              </div>)}
            </div>
          </div>
          {activeConv?.ownerId === user?.id && <p className="text-[11px] text-fg-subtle">{t('groupOwnerCannotLeaveNotice')}</p>}
        </div>
      </Modal>
    </div>
  );
};
