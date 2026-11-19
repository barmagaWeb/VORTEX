import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Send, Image, Smile, CheckCheck, Users, X } from 'lucide-react';
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
        if (active) showToast('Could not load conversations', 'error');
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
    const loadMessages = async () => {
      try {
        const result = await messagingService.getMessages(activeConv.id);
        if (!active) return;
        setMessages(result);
        await messagingService.markConversationAsRead(activeConv.id);
        await refreshConversations();
      } catch {
        if (active) showToast('Could not load messages', 'error');
      }
    };
    void loadMessages();

    const unsubscribe = messagingService.subscribeToMessages(activeConv.id, (message) => {
      setMessages((current) => current.some((item) => item.id === message.id)
        ? current
        : [...current, message]);
      if (message.senderId !== user?.id) void messagingService.markConversationAsRead(activeConv.id);
      void refreshConversations();
    });

    // A low-frequency refresh is retained as a recovery path for browsers where
    // the Realtime socket is temporarily unavailable. Production uses Supabase,
    // while the development Mock adapter uses its local store.
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
    setInputMessage('');
    setPendingAttachments([]);
    setPendingAttachmentPreviews([]);
    setIsSending(true);

    try {
      const sent = await messagingService.sendMessage(activeConv.id, text, attachments);
      setMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent]);
      previews.forEach((preview) => URL.revokeObjectURL(preview));
      void refreshConversations().catch((error: unknown) => console.error('Unable to refresh conversation list', error));
    } catch {
      setInputMessage(text);
      setPendingAttachments(attachments);
      setPendingAttachmentPreviews(previews);
      showToast('Could not send message', 'error');
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
      showToast('A message can contain up to four images.', 'error');
      return;
    }
    const accepted = files.filter((file) => IMAGE_TYPES.has(file.type)).slice(0, remaining);
    if (accepted.length !== files.length) showToast('Only JPG, PNG, WEBP and GIF images are supported.', 'error');
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
      showToast('Image upload failed', 'error');
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
      showToast(error instanceof Error ? error.message : 'Could not create group', 'error');
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
      showToast(error instanceof Error ? error.message : 'Could not load group members', 'error');
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
      showToast(error instanceof Error ? error.message : 'Could not rename group', 'error');
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
      showToast(error instanceof Error ? error.message : 'Could not add member', 'error');
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
      showToast(error instanceof Error ? error.message : 'Could not remove member', 'error');
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
      showToast(error instanceof Error ? error.message : 'Could not leave group', 'error');
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
    <div className="flex h-screen max-h-screen bg-slate-950 overflow-hidden">
      <div className={`w-full md:w-80 lg:w-96 border-e border-slate-800/80 flex flex-col bg-slate-950/60 ${activeConv ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h1 className="text-lg font-black text-white">{t('messages')}</h1>
            <button
              type="button"
              onClick={() => setShowGroupModal(true)}
              disabled={!isSupabaseConfigured()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-600/15 px-3 py-2 text-[11px] font-semibold text-violet-200 hover:bg-violet-600/25 disabled:opacity-40"
              title={!isSupabaseConfigured() ? t('connectSupabaseForGroups') : t('createGroup')}
            >
              <Users className="h-4 w-4" />
              <span>{t('newGroup')}</span>
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchConversations')}
              className="w-full bg-slate-900 text-slate-100 text-xs rounded-full ps-9 pe-4 py-2 border border-slate-800 focus:border-violet-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-850/50">
          {filteredConversations.map((conversation) => {
            const isSelected = activeConv?.id === conversation.id;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveConv(conversation)}
                className={`w-full text-start p-3.5 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-violet-950/30 border-s-4 border-violet-500' : 'hover:bg-slate-900/50'}`}
              >
                <Avatar src={conversation.participant.avatar} alt={conversation.groupName || conversation.participant.name} size="md" isOnline={conversation.isOnline} />
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">{conversation.groupName || conversation.participant.name}</span>
                    <span className="text-[10px] text-slate-500">{conversation.lastMessage?.createdAt}</span>
                  </span>
                  <span className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-slate-400 truncate max-w-[180px]">{conversation.isTyping ? 'Typing…' : conversation.lastMessage?.content}</span>
                    {conversation.unreadCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-600 text-white">{conversation.unreadCount}</span>}
                  </span>
                </span>
              </button>
            );
          })}
          {filteredConversations.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-slate-500">{t('noConversationsFound')}</p>
          )}
        </div>
      </div>

      {activeConv ? (
        <div className="flex-1 flex flex-col bg-slate-900/30 h-full min-w-0">
          <div className="p-3.5 sm:px-6 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md flex items-center gap-3">
            <button type="button" onClick={() => setActiveConv(null)} className="md:hidden p-1 rounded-lg text-slate-400 hover:text-white" aria-label="Back to conversations">←</button>
            <Avatar src={activeConv.participant.avatar} alt={activeConv.groupName || activeConv.participant.name} size="md" isOnline={activeConv.isOnline} />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white truncate">{activeConv.groupName || activeConv.participant.name}</span>
              <span className="text-[11px] text-slate-500">{activeConv.isGroup ? t('groupConversation') : `@${activeConv.participant.username}`}</span>
            </div>
            {activeConv.isGroup && (
              <button type="button" onClick={() => void openManageGroup()} disabled={isGroupUpdating} className="ms-auto rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-200 hover:border-violet-500 disabled:opacity-50">
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
                  <div className={`max-w-[82%] sm:max-w-md rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed shadow-md ${isMine ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-br-none' : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700/60'}`}>
                    {message.content && <p className="break-words whitespace-pre-wrap">{message.content}</p>}
                    {!!message.attachments?.length && (
                      <div className={`grid gap-1.5 ${message.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${message.content ? 'mt-2' : ''}`}>
                        {message.attachments.map((attachment, index) => (
                          <img key={`${message.id}-${index}`} src={attachment} alt="Message attachment" loading="lazy" className="max-h-64 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${isMine ? 'text-violet-200' : 'text-slate-400'}`}>
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
            <div className="px-4 pt-3 flex gap-2 flex-wrap border-t border-slate-800/60">
              {pendingAttachments.map((attachment, index) => (
                <div key={`${attachment.slice(0, 32)}-${index}`} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-700">
                  <img src={pendingAttachmentPreviews[index] || ''} alt="Pending attachment" className="h-full w-full object-cover" />
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

          <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center gap-2">
            <input ref={attachmentInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(event) => void handleAttachmentUpload(event)} />
            <button type="button" onClick={() => setInputMessage((previous) => `${previous} 😊`)} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors" aria-label="Add emoji"><Smile className="w-5 h-5" /></button>
            <button type="button" onClick={() => attachmentInputRef.current?.click()} disabled={isUploading || isSending || pendingAttachments.length >= 4} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors disabled:opacity-40" aria-label={t('attachImages')}><Image className="w-5 h-5" /></button>
            <input type="text" value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} placeholder={t('typeMessage')} maxLength={5000} disabled={isSending} className="flex-1 min-w-0 bg-slate-900 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-xl px-4 py-2.5 border border-slate-800 focus:border-violet-500 outline-none" />
            <button type="submit" disabled={(!inputMessage.trim() && pendingAttachments.length === 0) || isUploading || isSending} className="p-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 shadow-md shadow-violet-600/30 transition-all active:scale-95" aria-label="Send message"><Send className="w-4 h-4" /></button>
          </form>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center p-6 text-slate-500 text-sm">{t('selectConversation')}</div>
      )}

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
            <span className="text-xs font-semibold text-slate-300">{t('groupName')}</span>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} required className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" placeholder={t('groupName')} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">{t('addPeople')}</span>
            <input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" placeholder={t('searchPeople')} />
          </label>
          {selectedMembers.length > 0 && <div className="flex flex-wrap gap-2">{selectedMembers.map((member) => <button type="button" key={member.id} onClick={() => setSelectedMembers((current) => current.filter((item) => item.id !== member.id))} className="inline-flex items-center gap-1 rounded-full bg-violet-600/20 px-3 py-1.5 text-xs text-violet-200">@{member.username}<X className="h-3 w-3" /></button>)}</div>}
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-800 rounded-xl border border-slate-800">
            {memberResults.map((member) => {
              const selected = selectedMembers.some((item) => item.id === member.id);
              return <button type="button" key={member.id} onClick={() => setSelectedMembers((current) => selected ? current.filter((item) => item.id !== member.id) : [...current, member])} className="flex w-full items-center gap-3 px-3 py-2.5 text-start hover:bg-slate-800/60"><Avatar src={member.avatar} alt={member.name} size="sm" /><span className="flex-1 min-w-0"><span className="block truncate text-xs font-semibold text-white">{member.name}</span><span className="block truncate text-[11px] text-slate-400">@{member.username}</span></span><span className={`text-xs font-bold ${selected ? 'text-violet-300' : 'text-slate-500'}`}>{selected ? t('selected') : t('add')}</span></button>;
            })}
            {memberQuery.trim().length >= 2 && memberResults.length === 0 && <p className="px-3 py-5 text-center text-xs text-slate-500">{t('noPeopleFound')}</p>}
          </div>
          <p className="text-[11px] text-slate-500">{t('groupCreatedNotice')}</p>
        </form>
      </Modal>

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
                <label className="block text-xs font-semibold text-slate-300">{t('renameGroup')}</label>
                <div className="flex gap-2">
                  <input value={manageGroupName} onChange={(event) => setManageGroupName(event.target.value)} maxLength={80} className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" />
                  <Button variant="primary" onClick={() => void handleRenameGroup()} isLoading={isGroupUpdating} disabled={!manageGroupName.trim()}>{t('saveChanges')}</Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">{t('addPeople')}</label>
                <input value={manageMemberQuery} onChange={(event) => setManageMemberQuery(event.target.value)} placeholder={t('searchPeople')} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500" />
                {manageMemberResults.length > 0 && <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
                  {manageMemberResults.map((member) => <button key={member.id} type="button" disabled={isGroupUpdating} onClick={() => void handleAddGroupMember(member)} className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-slate-800/60 disabled:opacity-50"><Avatar src={member.avatar} alt={member.name} size="xs" /><span className="flex-1 truncate text-xs text-white">{member.name} <span className="text-slate-500">@{member.username}</span></span><span className="text-xs text-violet-300">{t('add')}</span></button>)}
                </div>}
              </div>
            </>
          ) : <p className="text-xs text-slate-400">{t('groupAdminOnly')}</p>}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-300">{t('groupMembers')} ({groupMembers.length})</h4>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 divide-y divide-slate-800">
              {groupMembers.map((member) => <div key={member.user.id} className="flex items-center gap-2 px-3 py-2.5">
                <Avatar src={member.user.avatar} alt={member.user.name} size="xs" />
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{member.user.name}</span><span className="block truncate text-[11px] text-slate-500">@{member.user.username}</span></span>
                {member.role === 'admin' && <span className="text-[10px] text-violet-300">{t('groupAdminLabel')}</span>}
                {groupMembers.some((item) => item.user.id === user?.id && item.role === 'admin') && member.user.id !== user?.id && member.user.id !== activeConv?.ownerId && <button type="button" disabled={isGroupUpdating} onClick={() => void handleRemoveGroupMember(member.user.id)} className="rounded-lg px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-50">{t('removeMember')}</button>}
              </div>)}
            </div>
          </div>
          {activeConv?.ownerId === user?.id && <p className="text-[11px] text-slate-500">{t('groupOwnerCannotLeaveNotice')}</p>}
        </div>
      </Modal>
    </div>
  );
};
