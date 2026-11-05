import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  Lock,
  Megaphone,
  MessagesSquare,
  Pin,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { EmptyState } from '../components/EmptyState';
import { ChatThreadModal } from '../modals/ChatThreadModal';
import { AnnouncementModal } from '../modals/AnnouncementModal';
import { MeetingModal } from '../modals/MeetingModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import type { Page } from '../nav';
import {
  ANNOUNCEMENT_PRIORITY_LABEL,
  ANNOUNCEMENT_STATUS_LABEL,
  CHAT_SCOPE_LABEL,
  MEETING_STATUS_LABEL,
} from '../constants';
import {
  buildInbox,
  inboxTotals,
  meetingTimestamp,
  threadLabel,
  unreadInbox,
  type InboxItem,
} from '../lib/communication';
import {
  formatDate,
  formatDateTime,
  relativeTime,
  todayISO,
} from '../lib/format';
import type {
  Announcement,
  ChatScope,
  ChatThread,
  Meeting,
} from '../types';

type CommTab = 'chats' | 'announcements' | 'meetings' | 'notifications';
type ChatFilter = 'all' | ChatScope;
type AnnouncementFilter = 'all' | 'team' | 'admin' | 'draft' | 'archived';
type InboxFilter = 'all' | 'unread';

const TABS: CommTab[] = ['chats', 'announcements', 'meetings', 'notifications'];

interface CommunicationProps {
  navigate: (page: Page, companyId?: string | null) => void;
}

export function Communication({ navigate }: CommunicationProps) {
  const data = useAppData();
  const { actions, confirm } = useApp();
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<CommTab>('chats');
  const [chatFilter, setChatFilter] = useState<ChatFilter>('all');
  const [announcementFilter, setAnnouncementFilter] = useState<AnnouncementFilter>('all');
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [threadOpen, setThreadOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageAuthor, setMessageAuthor] = useState('Yönetici');
  const [messageBody, setMessageBody] = useState('');
  const messageListRef = useRef<HTMLDivElement>(null);

  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );
  const companyName = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company.name])),
    [data.companies],
  );
  const departmentById = useMemo(
    () => new Map(data.departments.map((department) => [department.id, department])),
    [data.departments],
  );
  const employeeById = useMemo(
    () => new Map(data.employees.map((employee) => [employee.id, employee])),
    [data.employees],
  );
  const lastMessages = useMemo(() => {
    const map = new Map<string, (typeof data.chatMessages)[number]>();
    for (const message of data.chatMessages) {
      const current = map.get(message.threadId);
      if (!current || current.createdAt < message.createdAt) map.set(message.threadId, message);
    }
    return map;
  }, [data.chatMessages]);

  const threads = useMemo(
    () =>
      [...data.chatThreads]
        .filter((thread) => chatFilter === 'all' || thread.scope === chatFilter)
        .sort((a, b) => {
          const lastA = lastMessages.get(a.id)?.createdAt ?? a.updatedAt;
          const lastB = lastMessages.get(b.id)?.createdAt ?? b.updatedAt;
          return lastB - lastA;
        }),
    [data.chatThreads, chatFilter, lastMessages],
  );
  const activeThread =
    data.chatThreads.find((thread) => thread.id === activeThreadId) ?? null;
  const activeMessages = useMemo(
    () =>
      data.chatMessages
        .filter((message) => message.threadId === activeThread?.id)
        .sort((a, b) => a.createdAt - b.createdAt),
    [data.chatMessages, activeThread?.id],
  );
  const threadMembers = useMemo(
    () =>
      activeThread
        ? data.employees.filter(
            (employee) =>
              employee.companyId === activeThread.companyId && employee.status !== 'inactive',
          )
        : [],
    [data.employees, activeThread],
  );

  useEffect(() => {
    if (!threads.length) {
      setActiveThreadId(null);
      return;
    }
    setActiveThreadId((current) =>
      current && threads.some((thread) => thread.id === current) ? current : threads[0].id,
    );
  }, [threads]);

  useEffect(() => {
    if (!activeThread) return;
    setMessageAuthor((current) =>
      current === 'Yönetici' || threadMembers.some((employee) => employee.name === current)
        ? current
        : 'Yönetici',
    );
    setMessageBody('');
  }, [activeThread, threadMembers]);

  useEffect(() => {
    const node = messageListRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [activeMessages]);

  const inbox = useMemo(() => buildInbox(data), [data]);
  const unread = useMemo(
    () => unreadInbox(inbox, data.notificationReads),
    [inbox, data.notificationReads],
  );
  const inboxSummary = useMemo(() => inboxTotals(data, inbox), [data, inbox]);

  const filteredAnnouncements = useMemo(() => {
    const sorted = [...data.announcements].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.publishedAt ?? b.updatedAt) - (a.publishedAt ?? a.updatedAt);
    });
    return sorted.filter((announcement) => {
      if (announcementFilter === 'all') return true;
      if (announcementFilter === 'team') {
        return announcement.visibility === 'team' && announcement.status === 'published';
      }
      if (announcementFilter === 'admin') return announcement.visibility === 'admin';
      if (announcementFilter === 'draft') return announcement.status === 'draft';
      return announcement.status === 'archived';
    });
  }, [data.announcements, announcementFilter]);

  const sortedMeetings = useMemo(() => {
    const now = Date.now();
    return [...data.meetings].sort((a, b) => {
      const rankA = a.status === 'planned' ? 0 : 1;
      const rankB = b.status === 'planned' ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      if (rankA === 0) {
        const aTime = meetingTimestamp(a);
        const bTime = meetingTimestamp(b);
        const aUpcoming = aTime >= now ? 0 : 1;
        const bUpcoming = bTime >= now ? 0 : 1;
        if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
        return aTime - bTime;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [data.meetings]);

  const visibleInbox = useMemo(
    () => (inboxFilter === 'unread' ? unread : inbox),
    [inbox, unread, inboxFilter],
  );

  const today = todayISO();
  const upcomingMeetings = data.meetings.filter(
    (meeting) => meeting.status === 'planned' && meetingTimestamp(meeting) >= Date.now(),
  ).length;
  const todayMeetings = data.meetings.filter(
    (meeting) => meeting.status === 'planned' && meeting.date === today,
  ).length;
  const doneMeetings = data.meetings.filter((meeting) => meeting.status === 'done').length;
  const canceledMeetings = data.meetings.filter((meeting) => meeting.status === 'canceled').length;
  const publishedAnnouncements = data.announcements.filter(
    (announcement) => announcement.status === 'published',
  ).length;
  const adminAnnouncements = data.announcements.filter(
    (announcement) => announcement.visibility === 'admin',
  ).length;
  const pinnedAnnouncements = data.announcements.filter(
    (announcement) => announcement.pinned && announcement.status === 'published',
  ).length;
  const draftAnnouncements = data.announcements.filter(
    (announcement) => announcement.status === 'draft',
  ).length;
  const departmentThreads = data.chatThreads.filter(
    (thread) => thread.scope === 'department',
  ).length;
  const companyThreads = data.chatThreads.filter((thread) => thread.scope === 'company').length;

  const tabCount = (item: CommTab): number | null => {
    if (item === 'chats') return data.chatThreads.length;
    if (item === 'announcements') return data.announcements.length;
    if (item === 'meetings') return data.meetings.length;
    return unread.length;
  };

  const tabLabel = (item: CommTab) => {
    if (item === 'chats') return t('Sohbetler');
    if (item === 'announcements') return t('Duyurular');
    if (item === 'meetings') return t('Toplantılar');
    return t('Bildirimler');
  };

  const subtitle = () => {
    if (tab === 'chats') {
      return t('Şirket, departman ve birebir sohbetler; mesajlar bu çalışma alanında saklanır.');
    }
    if (tab === 'announcements') {
      return t('Ekip duyuruları ve yöneticiye özel notlar; sabitleyerek öne çıkar.');
    }
    if (tab === 'meetings') {
      return t('Toplantıları planla; katılımcı, gündem ve durumu kaydet.');
    }
    return t('Gecikmiş işler, faturalar, toplantılar ve duyurular tek akışta.');
  };

  const addLabel = () => {
    if (tab === 'chats') return t('Sohbet başlat');
    if (tab === 'announcements') return t('Duyuru oluştur');
    return t('Toplantı planla');
  };

  const openAdd = () => {
    if (tab === 'chats') setThreadOpen(true);
    else if (tab === 'announcements') {
      setEditingAnnouncement(null);
      setAnnouncementOpen(true);
    } else if (tab === 'meetings') {
      setEditingMeeting(null);
      setMeetingOpen(true);
    }
  };

  const markAllRead = async () => {
    if (!inbox.length) return;
    await actions.markNotificationsRead(inbox.map((item) => item.id));
  };

  const openNotification = async (item: InboxItem) => {
    await actions.markNotificationsRead([item.id]);
    if (item.target === 'communication') {
      setTab(item.kind === 'meeting' ? 'meetings' : 'announcements');
      return;
    }
    navigate(item.target);
  };

  const sendMessage = async () => {
    if (!activeThread || !messageBody.trim()) return;
    const success = await actions.sendChatMessage({
      threadId: activeThread.id,
      author: messageAuthor.trim() || t('Yönetici'),
      body: messageBody.trim(),
    });
    if (success) setMessageBody('');
  };

  const removeThread = async (thread: ChatThread) => {
    const name = threadLabel(thread, companyName, departmentById, employeeById, t);
    const sure = await confirm({
      title: t('Sohbet silinsin mi?'),
      message: t('“{name}” sohbeti ve mesajları silinecek.', { name }),
      confirmLabel: t('Sohbeti sil'),
    });
    if (!sure) return;
    const success = await actions.deleteChatThread(thread.id);
    if (success) setActiveThreadId(null);
  };

  const removeMessage = async (messageId: string) => {
    const sure = await confirm({
      title: t('Mesaj silinsin mi?'),
      message: t('Bu mesaj sohbetten kaldırılacak.'),
      confirmLabel: t('Mesajı sil'),
    });
    if (!sure) return;
    await actions.deleteChatMessage(messageId);
  };

  const inboxLabel = (kind: InboxItem['kind']) => {
    if (kind === 'announcement') return t('Duyuru');
    if (kind === 'meeting') return t('Toplantı');
    if (kind === 'invoice') return t('Gecikmiş fatura');
    if (kind === 'task') return t('Görev');
    if (kind === 'approval') return t('Onay talebi');
    if (kind === 'subscription') return t('Abonelik yenilemesi');
    return t('Maaş ödemesi');
  };

  const inboxIcon = (kind: InboxItem['kind']) => {
    if (kind === 'announcement') return <Megaphone size={15} />;
    if (kind === 'meeting') return <CalendarClock size={15} />;
    if (kind === 'invoice') return <BellRing size={15} />;
    if (kind === 'task') return <Check size={15} />;
    if (kind === 'approval') return <Users size={15} />;
    if (kind === 'subscription') return <Bell size={15} />;
    return <Building2 size={15} />;
  };

  const canAdd = data.companies.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={t('İşletme')}
        title={t('İletişim')}
        subtitle={subtitle()}
        actions={
          tab === 'notifications' ? (
            unread.length > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => void markAllRead()}>
                <Check size={15} /> {t('Tümünü okundu işaretle')}
              </button>
            ) : undefined
          ) : (
            <button type="button" className="btn btn-primary" onClick={openAdd} disabled={!canAdd}>
              <Plus size={15} /> {addLabel()}
            </button>
          )
        }
      />

      {!canAdd ? (
        <div className="card">
          <EmptyState
            icon={<MessagesSquare size={20} />}
            title={t('Önce bir şirket oluştur')}
            description={t('Sohbetler, duyurular ve toplantılar bir şirkete bağlanır. Şirket oluşturduktan sonra iletişim merkezini kullanabilirsin.')}
            action={
              <button type="button" className="btn btn-primary" onClick={() => navigate('companies')}>
                {t('Şirketler’e git')}
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="ops-toolbar comm-toolbar">
            <div className="segmented ops-tabs" role="tablist" aria-label={t('İletişim görünümü')}>
              {TABS.map((item) => {
                const count = tabCount(item);
                return (
                  <button
                    type="button"
                    role="tab"
                    key={item}
                    aria-selected={tab === item}
                    className={`segment ${tab === item ? 'active' : ''}`}
                    onClick={() => setTab(item)}
                  >
                    {tabLabel(item)}
                    {count !== null ? <span className="ops-tab-count">{count}</span> : null}
                  </button>
                );
              })}
            </div>

            {tab === 'chats' ? (
              <div className="segmented segmented-compact comm-filter">
                {(['all', 'company', 'department', 'direct'] as ChatFilter[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`segment ${chatFilter === item ? 'active' : ''}`}
                    onClick={() => setChatFilter(item)}
                  >
                    {item === 'all' ? t('Tümü') : t(CHAT_SCOPE_LABEL[item])}
                  </button>
                ))}
              </div>
            ) : null}

            {tab === 'announcements' ? (
              <div className="segmented segmented-compact comm-filter">
                {(['all', 'team', 'admin', 'draft', 'archived'] as AnnouncementFilter[]).map(
                  (item) => (
                    <button
                      type="button"
                      key={item}
                      className={`segment ${announcementFilter === item ? 'active' : ''}`}
                      onClick={() => setAnnouncementFilter(item)}
                    >
                      {item === 'all'
                        ? t('Tümü')
                        : item === 'team'
                          ? t('Ekip akışı')
                          : item === 'admin'
                            ? t('Yönetici')
                            : item === 'draft'
                              ? t('Taslak')
                              : t('Arşiv')}
                    </button>
                  ),
                )}
              </div>
            ) : null}

            {tab === 'notifications' ? (
              <div className="segmented segmented-compact comm-filter">
                {(['all', 'unread'] as InboxFilter[]).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={`segment ${inboxFilter === item ? 'active' : ''}`}
                    onClick={() => setInboxFilter(item)}
                  >
                    {item === 'all' ? t('Tümü') : t('Okunmamış')}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {tab === 'chats' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Sohbetler')}
                  value={data.chatThreads.length}
                  hint={t('{count} mesaj', { count: data.chatMessages.length })}
                  icon={<MessagesSquare size={16} />}
                  tone="mint"
                />
                <KpiCard
                  label={t('Şirket sohbetleri')}
                  value={companyThreads}
                  hint={t('Şirket geneli kanallar')}
                  icon={<Building2 size={16} />}
                />
                <KpiCard
                  label={t('Departman sohbetleri')}
                  value={departmentThreads}
                  hint={t('Departman kanalları')}
                  icon={<Users size={16} />}
                />
                <KpiCard
                  label={t('Birebir sohbetler')}
                  value={data.chatThreads.filter((thread) => thread.scope === 'direct').length}
                  hint={t('Çalışan bazlı kayıtlar')}
                  icon={<MessagesSquare size={16} />}
                />
              </div>

              {data.chatThreads.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<MessagesSquare size={20} />}
                    title={t('Henüz sohbet yok')}
                    description={t('Şirket geneli, departman veya birebir sohbet açarak ekip iletişim kaydını burada tut.')}
                    action={
                      <button type="button" className="btn btn-primary" onClick={() => setThreadOpen(true)}>
                        <Plus size={15} /> {t('Sohbet başlat')}
                      </button>
                    }
                  />
                </div>
              ) : (
                <div className={`comm-chat-shell ${activeThread ? 'has-active' : ''}`}>
                  <section className={`comm-chat-side ${activeThread ? 'has-active' : ''}`}>
                    {threads.length === 0 ? (
                      <div className="comm-chat-side-empty">{t('Bu filtrede sohbet yok.')}</div>
                    ) : (
                      <div className="comm-thread-list">
                        {threads.map((thread) => {
                          const last = lastMessages.get(thread.id);
                          const name = threadLabel(
                            thread,
                            companyName,
                            departmentById,
                            employeeById,
                            t,
                          );
                          const company = companyById.get(thread.companyId);
                          return (
                            <button
                              type="button"
                              key={thread.id}
                              className={`comm-thread ${activeThread?.id === thread.id ? 'active' : ''}`}
                              onClick={() => setActiveThreadId(thread.id)}
                            >
                              <span className={`comm-thread-icon scope-${thread.scope}`}>
                                {thread.scope === 'department' ? (
                                  <Users size={16} />
                                ) : thread.scope === 'direct' ? (
                                  <MessagesSquare size={16} />
                                ) : (
                                  <Building2 size={16} />
                                )}
                              </span>
                              <span className="comm-thread-main">
                                <span className="comm-thread-top">
                                  <strong>{name}</strong>
                                  {last ? (
                                    <time>{relativeTime(last.createdAt)}</time>
                                  ) : null}
                                </span>
                                <span className="comm-thread-sub">
                                  {company?.name ?? t('Şirketsiz')}
                                  {last ? ` · ${last.body}` : ` · ${t('Henüz mesaj yok')}`}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section className="comm-chat-main">
                    {activeThread ? (
                      <>
                        <header className="comm-chat-head">
                          <button
                            type="button"
                            className="icon-btn comm-chat-back"
                            onClick={() => setActiveThreadId(null)}
                            aria-label={t('Sohbet listesine dön')}
                          >
                            <ChevronLeft size={16} />
                          </button>
                          <div className="comm-chat-title">
                            <strong>
                              {threadLabel(
                                activeThread,
                                companyName,
                                departmentById,
                                employeeById,
                                t,
                              )}
                            </strong>
                            <span>
                              {companyById.get(activeThread.companyId)?.name ?? t('Şirketsiz')}
                              {' · '}
                              {t(CHAT_SCOPE_LABEL[activeThread.scope])}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="icon-btn danger"
                            onClick={() => void removeThread(activeThread)}
                            aria-label={t('Sohbeti sil')}
                            title={t('Sohbeti sil')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </header>

                        <div className="comm-messages" ref={messageListRef}>
                          {activeMessages.length === 0 ? (
                            <div className="comm-message-empty">
                              <MessagesSquare size={20} />
                              <strong>{t('Sohbet hazır')}</strong>
                              <span>{t('İlk mesajı yazarak iletişim kaydını başlat.')}</span>
                            </div>
                          ) : (
                            activeMessages.map((message) => (
                              <article className="comm-message" key={message.id}>
                                <div className="comm-message-head">
                                  <strong>{message.author || t('Yönetici')}</strong>
                                  <time>{formatDateTime(message.createdAt)}</time>
                                  <button
                                    type="button"
                                    className="comm-message-delete"
                                    onClick={() => void removeMessage(message.id)}
                                    aria-label={t('Mesajı sil')}
                                    title={t('Mesajı sil')}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <p>{message.body}</p>
                              </article>
                            ))
                          )}
                        </div>

                        <form
                          className="comm-composer"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void sendMessage();
                          }}
                        >
                          <label className="comm-author">
                            <span>{t('Yazan')}</span>
                            <select
                              value={messageAuthor}
                              onChange={(event) => setMessageAuthor(event.target.value)}
                            >
                              <option value="Yönetici">{t('Yönetici')}</option>
                              {threadMembers.map((employee) => (
                                <option key={employee.id} value={employee.name}>
                                  {employee.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="comm-compose-row">
                            <textarea
                              className="input textarea"
                              value={messageBody}
                              onChange={(event) => setMessageBody(event.target.value)}
                              placeholder={t('Mesajını yaz…')}
                              rows={2}
                              maxLength={4000}
                            />
                            <button
                              type="submit"
                              className="btn btn-primary comm-send"
                              disabled={!messageBody.trim()}
                            >
                              <Send size={15} /> {t('Gönder')}
                            </button>
                          </div>
                          <span className="comm-compose-hint">
                            {t('Mesajlar bu çalışma alanında saklanır; ekip üyelerine anlık iletilmez.')}
                          </span>
                        </form>
                      </>
                    ) : (
                      <div className="comm-chat-placeholder">
                        <MessagesSquare size={22} />
                        <strong>{t('Bir sohbet seç')}</strong>
                        <span>{t('Soldaki listeden sohbet aç veya yeni bir sohbet başlat.')}</span>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </>
          ) : null}

          {tab === 'announcements' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Yayında')}
                  value={publishedAnnouncements}
                  hint={t('{count} taslak', { count: draftAnnouncements })}
                  icon={<Megaphone size={16} />}
                  tone="mint"
                />
                <KpiCard
                  label={t('Yöneticiye özel')}
                  value={adminAnnouncements}
                  hint={t('Ekip akışından ayrı')}
                  icon={<Lock size={16} />}
                  tone="amber"
                />
                <KpiCard
                  label={t('Sabitlenen')}
                  value={pinnedAnnouncements}
                  hint={t('Öne çıkarılan duyurular')}
                  icon={<Pin size={16} />}
                />
                <KpiCard
                  label={t('Toplam duyuru')}
                  value={data.announcements.length}
                  hint={t('Tüm durumlar')}
                  icon={<Megaphone size={16} />}
                />
              </div>

              {filteredAnnouncements.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<Megaphone size={20} />}
                    title={t('Duyuru yok')}
                    description={t('Ekip akışına duyuru ekle veya yöneticiye özel bir not oluştur.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setEditingAnnouncement(null);
                          setAnnouncementOpen(true);
                        }}
                      >
                        <Plus size={15} /> {t('Duyuru oluştur')}
                      </button>
                    }
                  />
                </div>
              ) : (
                <div className="comm-announcement-list">
                  {filteredAnnouncements.map((announcement) => (
                    <article
                      key={announcement.id}
                      className={`comm-announcement priority-${announcement.priority} ${announcement.status === 'archived' ? 'is-archived' : ''}`}
                    >
                      <div className="comm-announcement-top">
                        <div className="comm-announcement-badges">
                          {announcement.pinned ? (
                            <span className="kind-badge announcement-pinned">
                              <Pin size={11} /> {t('Sabit')}
                            </span>
                          ) : null}
                          {announcement.visibility === 'admin' ? (
                            <span className="kind-badge announcement-admin">
                              <Lock size={11} /> {t('Yöneticiye özel')}
                            </span>
                          ) : null}
                          <span className={`kind-badge announcement-${announcement.status}`}>
                            {t(ANNOUNCEMENT_STATUS_LABEL[announcement.status])}
                          </span>
                          <span className={`kind-badge announcement-${announcement.priority}`}>
                            {t(ANNOUNCEMENT_PRIORITY_LABEL[announcement.priority])}
                          </span>
                          <span className="comm-announcement-audience">
                            {announcement.audience === 'company'
                              ? t('Tüm şirket')
                              : departmentById.get(announcement.departmentId ?? '')?.name ??
                                t('Departman')}
                          </span>
                        </div>
                        <div className="comm-row-actions">
                          <button
                            type="button"
                            className={`icon-btn ${announcement.pinned ? 'is-on' : ''}`}
                            onClick={() =>
                              void actions.updateAnnouncement({
                                id: announcement.id,
                                pinned: !announcement.pinned,
                              })
                            }
                            aria-label={announcement.pinned ? t('Sabitlemeyi kaldır') : t('Duyuruyu sabitle')}
                            title={announcement.pinned ? t('Sabitlemeyi kaldır') : t('Duyuruyu sabitle')}
                          >
                            <Pin size={14} />
                          </button>
                          {announcement.status === 'draft' ? (
                            <button
                              type="button"
                              className="btn btn-mini"
                              onClick={() =>
                                void actions.updateAnnouncement({
                                  id: announcement.id,
                                  status: 'published',
                                })
                              }
                            >
                              {t('Yayınla')}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-mini"
                            onClick={() => {
                              setEditingAnnouncement(announcement);
                              setAnnouncementOpen(true);
                            }}
                          >
                            {t('Düzenle')}
                          </button>
                        </div>
                      </div>
                      <h3>{announcement.title}</h3>
                      <p>{announcement.body}</p>
                      <footer className="comm-announcement-meta">
                        <span>
                          {companyById.get(announcement.companyId)?.name ?? t('Şirketsiz')}
                          {announcement.author ? ` · ${announcement.author}` : ''}
                        </span>
                        <span>
                          {formatDateTime(announcement.publishedAt ?? announcement.updatedAt)}
                        </span>
                      </footer>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {tab === 'meetings' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Yaklaşan toplantılar')}
                  value={upcomingMeetings}
                  hint={t('Planlanan ve henüz başlamamış')}
                  icon={<CalendarClock size={16} />}
                  tone="mint"
                />
                <KpiCard
                  label={t('Bugün')}
                  value={todayMeetings}
                  hint={formatDate(today)}
                  icon={<CalendarClock size={16} />}
                  tone={todayMeetings > 0 ? 'amber' : 'default'}
                />
                <KpiCard
                  label={t('Tamamlanan')}
                  value={doneMeetings}
                  hint={t('Arşivlenen toplantılar')}
                  icon={<Check size={16} />}
                />
                <KpiCard
                  label={t('İptal edilen')}
                  value={canceledMeetings}
                  hint={t('Planlanan toplantılar')}
                  icon={<CalendarClock size={16} />}
                  tone={canceledMeetings > 0 ? 'danger' : 'default'}
                />
              </div>

              {sortedMeetings.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<CalendarClock size={20} />}
                    title={t('Toplantı yok')}
                    description={t('Tarih, saat, katılımcı ve gündemle bir toplantı planla.')}
                    action={
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setEditingMeeting(null);
                          setMeetingOpen(true);
                        }}
                      >
                        <Plus size={15} /> {t('Toplantı planla')}
                      </button>
                    }
                  />
                </div>
              ) : (
                <div className="comm-meeting-list">
                  {sortedMeetings.map((meeting) => {
                    const date = new Date(`${meeting.date}T${meeting.time}:00`);
                    const attendees = meeting.attendeeIds
                      .map((id) => employeeById.get(id)?.name)
                      .filter((name): name is string => Boolean(name));
                    return (
                      <article
                        key={meeting.id}
                        className={`comm-meeting status-${meeting.status}`}
                      >
                        <div className="comm-meeting-date">
                          <strong>{String(date.getDate()).padStart(2, '0')}</strong>
                          <span>
                            {date.toLocaleDateString(locale, { month: 'short' }).toLocaleUpperCase(locale)}
                          </span>
                          <time>{meeting.time}</time>
                        </div>
                        <div className="comm-meeting-main">
                          <div className="comm-meeting-top">
                            <h3>{meeting.title}</h3>
                            <span className={`kind-badge meeting-${meeting.status}`}>
                              {t(MEETING_STATUS_LABEL[meeting.status])}
                            </span>
                          </div>
                          <p className="comm-meeting-meta">
                            <span>{companyById.get(meeting.companyId)?.name ?? t('Şirketsiz')}</span>
                            {meeting.departmentId ? (
                              <span>
                                {departmentById.get(meeting.departmentId)?.name ?? t('Departman')}
                              </span>
                            ) : null}
                            <span>{t('{count} dk', { count: meeting.durationMin })}</span>
                            {meeting.location ? <span>{meeting.location}</span> : null}
                          </p>
                          {meeting.agenda ? <p className="comm-meeting-agenda">{meeting.agenda}</p> : null}
                          <div className="comm-meeting-foot">
                            <span className="comm-meeting-attendees">
                              <Users size={13} />
                              {attendees.length
                                ? attendees.join(', ')
                                : t('Katılımcı eklenmedi')}
                            </span>
                            <button
                              type="button"
                              className="btn btn-mini"
                              onClick={() => {
                                setEditingMeeting(meeting);
                                setMeetingOpen(true);
                              }}
                            >
                              {t('Düzenle')}
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}

          {tab === 'notifications' ? (
            <>
              <div className="kpi-grid">
                <KpiCard
                  label={t('Okunmamış')}
                  value={inboxSummary.unread}
                  hint={t('{count} toplam bildirim', { count: inbox.length })}
                  icon={<Bell size={16} />}
                  tone={inboxSummary.unread > 0 ? 'amber' : 'mint'}
                />
                <KpiCard
                  label={t('Bugünkü toplantı')}
                  value={inboxSummary.meetingsToday}
                  hint={t('Bugün planlanan')}
                  icon={<CalendarClock size={16} />}
                />
                <KpiCard
                  label={t('Gecikmiş fatura')}
                  value={inboxSummary.overdueInvoices}
                  hint={t('Vadesi geçen alacaklar')}
                  icon={<BellRing size={16} />}
                  tone={inboxSummary.overdueInvoices > 0 ? 'danger' : 'default'}
                />
                <KpiCard
                  label={t('Bekleyen onay')}
                  value={inboxSummary.pendingApprovals}
                  hint={t('Operasyon onay talepleri')}
                  icon={<Users size={16} />}
                  tone={inboxSummary.pendingApprovals > 0 ? 'amber' : 'default'}
                />
              </div>

              {visibleInbox.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<Bell size={20} />}
                    title={t('Bildirim yok')}
                    description={t('Yaklaşan toplantı, gecikmiş iş ve duyurular burada toplanır.')}
                  />
                </div>
              ) : (
                <div className="comm-inbox-list">
                  {visibleInbox.map((item) => {
                    const read = data.notificationReads.some((entry) => entry.id === item.id);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className={`comm-inbox-item tone-${item.tone} ${read ? 'is-read' : ''}`}
                        onClick={() => void openNotification(item)}
                      >
                        <span className="comm-inbox-icon">{inboxIcon(item.kind)}</span>
                        <span className="comm-inbox-main">
                          <span className="comm-inbox-top">
                            <strong>{item.title}</strong>
                            <span className={`kind-badge inbox-${item.kind}`}>{inboxLabel(item.kind)}</span>
                            {item.adminOnly ? (
                              <span className="kind-badge announcement-admin">
                                <Lock size={11} /> {t('Yöneticiye özel')}
                              </span>
                            ) : null}
                          </span>
                          <span className="comm-inbox-meta">
                            {[item.meta, companyName.get(item.companyId ?? '')]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                        <span className="comm-inbox-side">
                          <time>{relativeTime(item.at)}</time>
                          {!read ? <span className="comm-unread-dot" /> : null}
                          {!read ? (
                            <span
                              className="comm-inbox-read"
                              role="button"
                              tabIndex={0}
                              title={t('Okundu işaretle')}
                              onClick={(event) => {
                                event.stopPropagation();
                                void actions.markNotificationsRead([item.id]);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void actions.markNotificationsRead([item.id]);
                                }
                              }}
                            >
                              <Check size={13} />
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </>
      )}

      <ChatThreadModal open={threadOpen} onClose={() => setThreadOpen(false)} />
      <AnnouncementModal
        open={announcementOpen}
        onClose={() => {
          setAnnouncementOpen(false);
          setEditingAnnouncement(null);
        }}
        announcement={editingAnnouncement}
      />
      <MeetingModal
        open={meetingOpen}
        onClose={() => {
          setMeetingOpen(false);
          setEditingMeeting(null);
        }}
        meeting={editingMeeting}
      />
    </>
  );
}
