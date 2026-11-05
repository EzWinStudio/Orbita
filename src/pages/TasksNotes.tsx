import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  FileText,
  ListChecks,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';
import { CompanyChip } from '../components/CompanyChip';
import { TaskModal } from '../modals/TaskModal';
import { NoteModal } from '../modals/NoteModal';
import { useApp, useAppData } from '../store';
import { useI18n } from '../i18n';
import type { NavIntent } from '../nav';
import type { Note, Task } from '../types';
import type { TranslationKey } from '../i18n/core';
import { dueLabel, relativeTime, todayISO } from '../lib/format';

interface TasksNotesProps {
  intent: NavIntent | null;
  onIntentHandled: () => void;
}

type TaskFilter = 'open' | 'done' | 'all';

const PRIORITY_WEIGHT = { high: 3, med: 2, low: 1 } as const;

export function TasksNotes({ intent, onIntentHandled }: TasksNotesProps) {
  const data = useAppData();
  const { actions, confirm } = useApp();
  const { t } = useI18n();
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('open');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const quickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (intent?.kind === 'task') {
      setEditingTask(null);
      setTaskModalOpen(true);
      onIntentHandled();
    } else if (intent?.kind === 'note') {
      setEditingNote(null);
      setNoteModalOpen(true);
      onIntentHandled();
    }
  }, [intent, onIntentHandled]);

  const today = todayISO();
  const companyById = useMemo(
    () => new Map(data.companies.map((company) => [company.id, company])),
    [data.companies],
  );

  const scopedTasks = useMemo(
    () =>
      data.tasks.filter((task) => companyFilter === 'all' || task.companyId === companyFilter),
    [data.tasks, companyFilter],
  );

  const openTasks = useMemo(
    () =>
      scopedTasks
        .filter((task) => !task.done)
        .sort((a, b) => {
          const aDue = a.due ? Date.parse(a.due) : Number.MAX_SAFE_INTEGER;
          const bDue = b.due ? Date.parse(b.due) : Number.MAX_SAFE_INTEGER;
          if (aDue !== bDue) return aDue - bDue;
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }),
    [scopedTasks],
  );

  const doneTasks = useMemo(
    () => scopedTasks.filter((task) => task.done).sort((a, b) => b.createdAt - a.createdAt),
    [scopedTasks],
  );

  const groups = useMemo(() => {
    const overdue = openTasks.filter((task) => task.due && task.due < today);
    const todayTasks = openTasks.filter((task) => task.due === today);
    const upcoming = openTasks.filter((task) => task.due && task.due > today);
    const undated = openTasks.filter((task) => !task.due);
    const allGroups: { key: string; label: TranslationKey; tasks: Task[]; tone: string }[] = [
      { key: 'overdue', label: 'Geciken', tasks: overdue, tone: 'danger' },
      { key: 'today', label: 'Bugün', tasks: todayTasks, tone: 'today' },
      { key: 'upcoming', label: 'Yaklaşan', tasks: upcoming, tone: 'normal' },
      { key: 'undated', label: 'Tarihsiz', tasks: undated, tone: 'normal' },
    ];
    return allGroups.filter((group) => group.tasks.length > 0);
  }, [openTasks, today]);

  const allNotes = useMemo(
    () =>
      [...data.notes].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      }),
    [data.notes],
  );

  const overdueCount = data.tasks.filter((task) => !task.done && task.due && task.due < today).length;

  const quickAdd = async () => {
    const title = quickTitle.trim();
    if (!title || quickBusy) return;
    setQuickBusy(true);
    const success = await actions.createTask({
      title,
      companyId: companyFilter === 'all' ? null : companyFilter,
      priority: 'med',
    });
    setQuickBusy(false);
    if (success) {
      setQuickTitle('');
      quickRef.current?.focus();
    }
  };

  const toggleTask = async (task: Task) => {
    if (togglingId) return;
    setTogglingId(task.id);
    await actions.updateTask({ id: task.id, done: !task.done });
    setTogglingId(null);
  };

  const removeTask = async (task: Task) => {
    const sure = await confirm({
      title: t('Görev silinsin mi?'),
      message: t('“{title}” kalıcı olarak silinecek.', { title: task.title }),
      confirmLabel: t('Görevi sil'),
    });
    if (!sure) return;
    await actions.deleteTask(task.id);
  };

  const togglePin = async (note: Note) => {
    if (pinBusyId) return;
    setPinBusyId(note.id);
    await actions.updateNote({ id: note.id, pinned: !note.pinned });
    setPinBusyId(null);
  };

  const removeNote = async (note: Note) => {
    const sure = await confirm({
      title: t('Not silinsin mi?'),
      message: t('“{title}” kalıcı olarak silinecek.', { title: note.title }),
      confirmLabel: t('Notu sil'),
    });
    if (!sure) return;
    await actions.deleteNote(note.id);
  };

  const renderTask = (task: Task) => {
    const due = dueLabel(task.due);
    const company = task.companyId ? companyById.get(task.companyId) : null;
    return (
      <div className={`task-row task-row-full ${task.done ? 'is-done' : ''}`} key={task.id}>
        <button
          type="button"
          className={`task-check ${task.done ? 'checked' : ''} ${togglingId === task.id ? 'pending' : ''}`}
          onClick={() => void toggleTask(task)}
          aria-label={task.done ? t('Görevi geri aç') : t('Görevi tamamla')}
        >
          {task.done ? <Check size={11} /> : null}
        </button>
        <button
          type="button"
          className="task-main"
          onClick={() => {
            setEditingTask(task);
            setTaskModalOpen(true);
          }}
        >
          <span className="task-title">{task.title}</span>
          <span className="task-meta">
            <span className={`priority-dot priority-dot-${task.priority}`} />
            <CompanyChip company={company} />
            {task.assigneeId ? (
              <span className="task-assignee">
                {data.employees.find((employee) => employee.id === task.assigneeId)?.name ?? t('Atanmadı')}
              </span>
            ) : null}
            {due ? <span className={`due due-${due.tone}`}>{due.text}</span> : <span className="due due-none">{t('Tarihsiz')}</span>}
          </span>
        </button>
        <button
          type="button"
          className="icon-btn task-delete"
          onClick={() => void removeTask(task)}
          aria-label={t('Görevi sil')}
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow={t('İşletme')}
        title={t('Görev & Notlar')}
        subtitle={`${t('{open} açık görev · {notes} not', {
          open: openTasks.length,
          notes: data.notes.length,
        })}${overdueCount ? ` · ${t('{count} geciken', { count: overdueCount })}` : ''}`}
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditingNote(null);
                setNoteModalOpen(true);
              }}
            >
              <FileText size={15} /> {t('Not ekle')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEditingTask(null);
                setTaskModalOpen(true);
              }}
            >
              <Plus size={15} /> {t('Görev ekle')}
            </button>
          </>
        }
      />

      <div className="tasks-layout">
        <section className="card tasks-card">
          <div className="card-header">
            <div>
              <h2>{t('Görevler')}</h2>
              <p>{t('Öncelik ve tarihe göre düzenli takip.')}</p>
            </div>
          </div>

          <div className="task-toolbar">
            <div className="segmented">
              <button
                type="button"
                className={`segment ${taskFilter === 'open' ? 'active' : ''}`}
                onClick={() => setTaskFilter('open')}
              >
                {t('Açık')} {openTasks.length}
              </button>
              <button
                type="button"
                className={`segment ${taskFilter === 'done' ? 'active' : ''}`}
                onClick={() => setTaskFilter('done')}
              >
                {t('Tamamlanan')} {doneTasks.length}
              </button>
              <button
                type="button"
                className={`segment ${taskFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTaskFilter('all')}
              >
                {t('Tümü')}
              </button>
            </div>
            <select
              className="input select select-compact"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              aria-label={t('Şirkete göre filtrele')}
            >
              <option value="all">{t('Tüm şirketler')}</option>
              {data.companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>

          <div className="quick-add">
            <Plus size={14} />
            <input
              ref={quickRef}
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void quickAdd();
                }
              }}
              placeholder={t('Hızlı görev ekle ve Enter’a bas…')}
              maxLength={200}
              aria-label={t('Hızlı görev')}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => void quickAdd()}
              disabled={!quickTitle.trim() || quickBusy}
            >
              {t('Ekle')}
            </button>
          </div>

          {scopedTasks.length === 0 ? (
            <EmptyState
              compact
              icon={<ListChecks size={18} />}
              title={t('Görev yok')}
              description={t('Yapılacakları küçük adımlara böl, tarih ver ve takip et.')}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingTask(null);
                    setTaskModalOpen(true);
                  }}
                >
                  {t('Görev ekle')}
                </button>
              }
            />
          ) : taskFilter === 'done' ? (
            <div className="task-groups">
              {doneTasks.length === 0 ? (
                <p className="muted-line">{t('Henüz tamamlanan görev yok.')}</p>
              ) : (
                <div className="task-group">
                  <div className="task-group-head">
                    <span>{t('Tamamlanan')}</span>
                    <span className="task-group-count">{doneTasks.length}</span>
                  </div>
                  {doneTasks.map(renderTask)}
                </div>
              )}
            </div>
          ) : (
            <div className="task-groups">
              {groups.map((group) => (
                <div className={`task-group task-group-${group.tone}`} key={group.key}>
                  <div className="task-group-head">
                    <span>{t(group.label)}</span>
                    <span className="task-group-count">{group.tasks.length}</span>
                  </div>
                  {group.tasks.map(renderTask)}
                </div>
              ))}
              {taskFilter === 'all' && doneTasks.length > 0 ? (
                <div className="task-group task-group-done">
                  <div className="task-group-head">
                    <span>{t('Tamamlanan')}</span>
                    <span className="task-group-count">{doneTasks.length}</span>
                  </div>
                  {doneTasks.map(renderTask)}
                </div>
              ) : null}
              {openTasks.length === 0 && doneTasks.length > 0 ? (
                <p className="muted-line">{t('Açık görev kalmadı. Tamamlananlara geçerek geçmişi görebilirsin.')}</p>
              ) : null}
            </div>
          )}
        </section>

        <section className="card notes-card">
          <div className="card-header">
            <div>
              <h2>{t('Notlar')}</h2>
              <p>{t('Sabitlenenler üstte, son güncellenen önce.')}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setEditingNote(null);
                setNoteModalOpen(true);
              }}
              aria-label={t('Not ekle')}
            >
              <Plus size={15} />
            </button>
          </div>

          {allNotes.length === 0 ? (
            <EmptyState
              compact
              icon={<FileText size={18} />}
              title={t('Not yok')}
              description={t('Fikirlerini, kararlarını ve operasyon detaylarını şirketlerine bağlı notlar olarak sakla.')}
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingNote(null);
                    setNoteModalOpen(true);
                  }}
                >
                  {t('Not ekle')}
                </button>
              }
            />
          ) : (
            <div className="notes-list">
              {allNotes.map((note) => {
                const company = note.companyId ? companyById.get(note.companyId) : null;
                return (
                  <article className={`note-card ${note.pinned ? 'pinned' : ''}`} key={note.id}>
                    <div className="note-card-head">
                      <button
                        type="button"
                        className="note-card-title"
                        onClick={() => {
                          setEditingNote(note);
                          setNoteModalOpen(true);
                        }}
                      >
                        {note.title}
                      </button>
                      <div className="note-card-actions">
                        <button
                          type="button"
                          className={`icon-btn ${note.pinned ? 'is-active' : ''}`}
                          onClick={() => void togglePin(note)}
                          disabled={pinBusyId === note.id}
                          aria-label={note.pinned ? t('Sabitlemeyi kaldır') : t('Notu sabitle')}
                        >
                          {note.pinned ? <Pin size={13} /> : <PinOff size={13} />}
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => void removeNote(note)}
                          aria-label={t('Notu sil')}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="note-card-body"
                      onClick={() => {
                        setEditingNote(note);
                        setNoteModalOpen(true);
                      }}
                    >
                      {note.body || t('İçerik yok.')}
                    </button>
                    <div className="note-card-foot">
                      <CompanyChip company={company} />
                      <span className="note-updated">{relativeTime(note.updatedAt)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <TaskModal
        open={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editingTask}
        defaultCompanyId={companyFilter === 'all' ? null : companyFilter}
      />
      <NoteModal open={noteModalOpen} onClose={() => setNoteModalOpen(false)} note={editingNote} />
    </>
  );
}
