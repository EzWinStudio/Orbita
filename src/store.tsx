import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type {
  AddConnectionInput,
  AppData,
  ApprovalStatus,
  AssistantMessage,
  AssistantReply,
  AuthResult,
  ChangePasswordInput,
  UpdateProfileInput,
  UpdateSecurityInput,
  AssetTestInput,
  CreateApprovalInput,
  CreateAnnouncementInput,
  CreateAssetInput,
  CreateAutomationRuleInput,
  CreateBugInput,
  CreateChatMessageInput,
  CreateChatThreadInput,
  CreateClientInput,
  CreateCompanyInput,
  CreateContractInput,
  CreateDepartmentInput,
  CreateDocumentInput,
  CreateEmployeeInput,
  CreateFinanceInput,
  CreateInvoiceInput,
  CreateCustomerPaymentInput,
  CreateMeetingInput,
  CreateNoteInput,
  CreatePerformanceReviewInput,
  CreateProjectInput,
  CreateRoleInput,
  CreateSalaryInput,
  CreateSubscriptionInput,
  CreateTaskInput,
  InitialPayload,
  LanguageCode,
  Meta,
  RatesPayload,
  TestResult,
  UpdateApprovalInput,
  UpdateAnnouncementInput,
  UpdateAssetInput,
  UpdateAutomationRuleInput,
  UpdateBugInput,
  UpdateClientInput,
  UpdateCompanyInput,
  UpdateContractInput,
  UpdateDepartmentInput,
  UpdateDocumentInput,
  UpdateEmployeeInput,
  UpdateInvoiceInput,
  UpdateCustomerPaymentInput,
  UpdateMeetingInput,
  UpdateNoteInput,
  UpdatePerformanceReviewInput,
  UpdateProjectInput,
  UpdateRoleInput,
  UpdateSalaryInput,
  UpdateSettingsInput,
  UpdateSubscriptionInput,
  TranslationResult,
  UpdateCheck,
  UpdateTaskInput,
  SecurityEventKind,
  YoutubeTestResult,
  YoutubeUpdate,
} from './types';
import { normalizeLanguage } from './i18n/languages';
import { getGlobalLanguage, tGlobal, translateMessage } from './i18n/core';
import type { TranslationKey } from './i18n/core';
import { ConfirmDialog } from './components/ConfirmDialog';
import {
  applyFullscreen,
  applyReduceMotion,
  applyTheme,
  isAppTheme,
} from './lib/appearance';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

interface AppActions {
  createCompany: (input: CreateCompanyInput) => Promise<boolean>;
  updateCompany: (input: UpdateCompanyInput) => Promise<boolean>;
  deleteCompany: (id: string) => Promise<boolean>;
  createAsset: (input: CreateAssetInput) => Promise<boolean>;
  updateAsset: (input: UpdateAssetInput) => Promise<boolean>;
  deleteAsset: (id: string) => Promise<boolean>;
  testAsset: (input: AssetTestInput) => Promise<TestResult | null>;
  createTask: (input: CreateTaskInput) => Promise<boolean>;
  updateTask: (input: UpdateTaskInput) => Promise<boolean>;
  deleteTask: (id: string) => Promise<boolean>;
  createNote: (input: CreateNoteInput) => Promise<boolean>;
  updateNote: (input: UpdateNoteInput) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
  createFinance: (input: CreateFinanceInput) => Promise<boolean>;
  deleteFinance: (id: string) => Promise<boolean>;
  createSalary: (input: CreateSalaryInput) => Promise<boolean>;
  updateSalary: (input: UpdateSalaryInput) => Promise<boolean>;
  deleteSalary: (id: string) => Promise<boolean>;
  createInvoice: (input: CreateInvoiceInput) => Promise<boolean>;
  updateInvoice: (input: UpdateInvoiceInput) => Promise<boolean>;
  deleteInvoice: (id: string) => Promise<boolean>;
  createCustomerPayment: (input: CreateCustomerPaymentInput) => Promise<boolean>;
  updateCustomerPayment: (input: UpdateCustomerPaymentInput) => Promise<boolean>;
  deleteCustomerPayment: (id: string) => Promise<boolean>;
  createSubscription: (input: CreateSubscriptionInput) => Promise<boolean>;
  updateSubscription: (input: UpdateSubscriptionInput) => Promise<boolean>;
  deleteSubscription: (id: string) => Promise<boolean>;
  createChatThread: (input: CreateChatThreadInput) => Promise<boolean>;
  deleteChatThread: (id: string) => Promise<boolean>;
  sendChatMessage: (input: CreateChatMessageInput) => Promise<boolean>;
  deleteChatMessage: (id: string) => Promise<boolean>;
  createAnnouncement: (input: CreateAnnouncementInput) => Promise<boolean>;
  updateAnnouncement: (input: UpdateAnnouncementInput) => Promise<boolean>;
  deleteAnnouncement: (id: string) => Promise<boolean>;
  createMeeting: (input: CreateMeetingInput) => Promise<boolean>;
  updateMeeting: (input: UpdateMeetingInput) => Promise<boolean>;
  deleteMeeting: (id: string) => Promise<boolean>;
  markNotificationsRead: (ids: string[]) => Promise<boolean>;
  createClient: (input: CreateClientInput) => Promise<boolean>;
  updateClient: (input: UpdateClientInput) => Promise<boolean>;
  deleteClient: (id: string) => Promise<boolean>;
  createContract: (input: CreateContractInput) => Promise<boolean>;
  updateContract: (input: UpdateContractInput) => Promise<boolean>;
  deleteContract: (id: string) => Promise<boolean>;
  createDocument: (input: CreateDocumentInput) => Promise<boolean>;
  updateDocument: (input: UpdateDocumentInput) => Promise<boolean>;
  deleteDocument: (id: string) => Promise<boolean>;
  createBug: (input: CreateBugInput) => Promise<boolean>;
  updateBug: (input: UpdateBugInput) => Promise<boolean>;
  deleteBug: (id: string) => Promise<boolean>;
  createAutomationRule: (input: CreateAutomationRuleInput) => Promise<boolean>;
  updateAutomationRule: (input: UpdateAutomationRuleInput) => Promise<boolean>;
  deleteAutomationRule: (id: string) => Promise<boolean>;
  runAutomationRule: (id: string) => Promise<boolean>;
  logSecurityEvent: (input: {
    kind: SecurityEventKind;
    actor?: string;
    detail: string;
    companyId?: string | null;
  }) => Promise<boolean>;
  clearSecurityEvents: () => Promise<boolean>;
  createEmployee: (input: CreateEmployeeInput) => Promise<boolean>;
  updateEmployee: (input: UpdateEmployeeInput) => Promise<boolean>;
  deleteEmployee: (id: string) => Promise<boolean>;
  createDepartment: (input: CreateDepartmentInput) => Promise<boolean>;
  updateDepartment: (input: UpdateDepartmentInput) => Promise<boolean>;
  deleteDepartment: (id: string) => Promise<boolean>;
  createRole: (input: CreateRoleInput) => Promise<boolean>;
  updateRole: (input: UpdateRoleInput) => Promise<boolean>;
  deleteRole: (id: string) => Promise<boolean>;
  createPerformanceReview: (input: CreatePerformanceReviewInput) => Promise<boolean>;
  updatePerformanceReview: (input: UpdatePerformanceReviewInput) => Promise<boolean>;
  deletePerformanceReview: (id: string) => Promise<boolean>;
  createProject: (input: CreateProjectInput) => Promise<boolean>;
  updateProject: (input: UpdateProjectInput) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  createApproval: (input: CreateApprovalInput) => Promise<boolean>;
  updateApproval: (input: UpdateApprovalInput) => Promise<boolean>;
  deleteApproval: (id: string) => Promise<boolean>;
  decideApproval: (
    id: string,
    status: Exclude<ApprovalStatus, 'pending'>,
    decision?: { decidedBy?: string; decisionNote?: string },
  ) => Promise<boolean>;
  updateSettings: (input: UpdateSettingsInput) => Promise<boolean>;
  addYoutubeKey: (label: string, key: string) => Promise<boolean>;
  removeYoutubeKey: (id: string) => Promise<boolean>;
  setDefaultYoutubeKey: (id: string) => Promise<boolean>;
  testYoutubeKey: (input?: { id?: string; key?: string }) => Promise<YoutubeTestResult | null>;
  addYoutubeChannel: (companyId: string, url: string, keyId?: string) => Promise<boolean>;
  setYoutubeChannelKey: (id: string, keyId: string) => Promise<boolean>;
  removeYoutubeChannel: (id: string) => Promise<boolean>;
  refreshYoutube: () => Promise<boolean>;
  refreshMonitor: () => Promise<boolean>;
  addConnection: (input: AddConnectionInput) => Promise<boolean>;
  verifyConnection: (id: string) => Promise<boolean>;
  refreshConnection: (id: string) => Promise<boolean>;
  primaryConnection: (id: string) => Promise<boolean>;
  removeConnection: (id: string) => Promise<boolean>;
  importMusic: () => Promise<{ added: number; skipped: string[] } | null>;
  removeTrack: (id: string) => Promise<boolean>;
  updateTrack: (input: { id: string; title?: string; artist?: string }) => Promise<boolean>;
  translateText: (input: {
    text: string;
    source: string;
    target: string;
  }) => Promise<TranslationResult | null>;
  markNotesSeen: (version: string) => Promise<boolean>;
  saveUpdateSettings: (input: { autoUpdate?: boolean; updateFeedUrl?: string }) => Promise<boolean>;
  checkUpdates: () => Promise<UpdateCheck | null>;
  installUpdate: () => Promise<boolean>;
  lockApp: () => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  updateAccountProfile: (input: UpdateProfileInput) => Promise<AuthResult | null>;
  changePassword: (input: ChangePasswordInput) => Promise<AuthResult | null>;
  updateAccountSecurity: (input: UpdateSecurityInput) => Promise<AuthResult | null>;
  askAssistant: (input: {
    message: string;
    history?: AssistantMessage[];
  }) => Promise<AssistantReply | null>;
}

interface AppContextValue {
  loading: boolean;
  fatalError: string | null;
  data: AppData | null;
  meta: Meta | null;
  rates: RatesPayload | null;
  ratesLoading: boolean;
  ratesError: string | null;
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => Promise<void>;
  refreshRates: (force?: boolean) => Promise<void>;
  actions: AppActions;
  toast: (kind: ToastKind, message: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const LANGUAGE_STORAGE_KEY = 'ezwin.language';

function storedLanguage(): LanguageCode {
  try {
    return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {
    return 'tr';
  }
}

const AppContext = createContext<AppContextValue | null>(null);

function errorMessage(err: unknown): string {
  if (err instanceof Error) return translateMessage(getGlobalLanguage(), err.message);
  return tGlobal('Beklenmeyen bir hata oluştu.');
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [rates, setRates] = useState<RatesPayload | null>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [language, setLanguageState] = useState<LanguageCode>(storedLanguage);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const toastId = useRef(1);
  const ratesRequest = useRef(0);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = toastId.current++;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4200);
  }, []);

  useEffect(() => {
    const api = window.ezwin;
    if (!api) {
      setFatalError(
        tGlobal('Arayüz masaüstü uygulaması dışında açıldı. Orbita’yı başlatmak için uygulamayı çalıştır.'),
      );
      setLoading(false);
      return;
    }

    let active = true;
    api
      .getInitial()
      .then((payload: InitialPayload) => {
        if (!active) return;
        const nextLanguage = normalizeLanguage(payload.state.settings.language);
        const nextTheme = isAppTheme(payload.state.settings.theme)
          ? payload.state.settings.theme
          : 'night';
        applyTheme(nextTheme, true);
        applyReduceMotion(Boolean(payload.state.settings.reduceMotion), true);
        setData(payload.state);
        setMeta(payload.meta);
        setLanguageState(nextLanguage);
        try {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
        } catch {
          return;
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setFatalError(errorMessage(err));
        setLoading(false);
      });

    const off = api.onStatuses((statuses) => {
      setData((prev) => (prev ? { ...prev, statuses } : prev));
    });

    const offYoutube = api.onYoutube((payload: YoutubeUpdate) => {
      setData((prev) =>
        prev
          ? {
              ...prev,
              youtubeChannels: payload.channels,
              youtubeEvents: payload.events,
            }
          : prev,
      );
      if (!payload.newEvents.length) return;
      const comments = payload.newEvents.filter((event) => event.kind === 'comment');
      const subscribers = payload.newEvents.filter((event) => event.kind === 'subscriber');
      if (comments.length === 1) {
        const event = comments[0];
        toast(
          'info',
          tGlobal('YouTube · {channel}: {author} yeni yorum yazdı', {
            channel: event.channelTitle,
            author: event.author ?? 'YouTube',
          }),
        );
      } else if (comments.length > 1) {
        toast('info', tGlobal('YouTube · {count} yeni yorum', { count: comments.length }));
      }
      if (subscribers.length) {
        const total = subscribers.reduce((sum, event) => sum + (event.count ?? 0), 0);
        if (total > 0) {
          const channel =
            subscribers.length === 1
              ? subscribers[0].channelTitle
              : tGlobal('{count} kanal', { count: subscribers.length });
          toast(
            'success',
            tGlobal('YouTube · {channel}: {count} yeni abone', { channel, count: total }),
          );
        }
      }
    });

    const offFullscreen = api.onFullscreen((fullscreen) => {
      applyFullscreen(fullscreen);
    });

    const offMaximized = api.onMaximized((maximized) => {
      setData((prev) =>
        prev ? { ...prev, settings: { ...prev.settings, maximized } } : prev,
      );
    });

    return () => {
      active = false;
      off();
      offYoutube();
      offFullscreen();
      offMaximized();
    };
  }, [toast]);

  useEffect(() => {
    if (!data) return;
    applyTheme(data.settings.theme, true);
    applyReduceMotion(Boolean(data.settings.reduceMotion), true);
  }, [data?.settings.theme, data?.settings.reduceMotion]);

  useEffect(() => {
    const onSynced = (event: Event) => {
      const next = (event as CustomEvent<AppData>).detail;
      if (next) setData(next);
    };
    window.addEventListener('ezwin:sync-applied', onSynced);
    return () => window.removeEventListener('ezwin:sync-applied', onSynced);
  }, []);

  const refreshRates = useCallback(async (force = false) => {
    const api = window.ezwin;
    if (!api) return;
    const request = ratesRequest.current + 1;
    ratesRequest.current = request;
    setRatesLoading(true);
    try {
      const next = force ? await api.rates.refresh() : await api.rates.get();
      if (ratesRequest.current !== request) return;
      setRates(next);
      setRatesError(next.error ?? null);
    } catch (err) {
      if (ratesRequest.current !== request) return;
      setRatesError(errorMessage(err));
    } finally {
      if (ratesRequest.current === request) setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!window.ezwin) return;
    void refreshRates(false);
    const timer = window.setInterval(() => void refreshRates(false), 15 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [refreshRates]);

  const setLanguage = useCallback(
    async (next: LanguageCode) => {
      const previous = language;
      setLanguageState(next);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
      } catch {
        return;
      }
      try {
        const api = window.ezwin;
        if (!api) throw new Error('Uygulama bağlantısı kurulamadı.');
        const nextData = await api.settings.update({ language: next });
        setData(nextData);
      } catch (err) {
        setLanguageState(previous);
        try {
          localStorage.setItem(LANGUAGE_STORAGE_KEY, previous);
        } catch {
          return;
        }
        toast('error', translateMessage(previous, errorMessage(err)));
      }
    },
    [language, toast],
  );

  const runMutation = useCallback(
    async (mutation: () => Promise<AppData>, successMessage?: TranslationKey): Promise<boolean> => {
      try {
        const next = await mutation();
        setData(next);
        if (successMessage) toast('success', tGlobal(successMessage));
        return true;
      } catch (err) {
        toast('error', errorMessage(err));
        return false;
      }
    },
    [toast],
  );

  const actions = useMemo<AppActions>(() => {
    const api = () => {
      if (!window.ezwin) throw new Error('Uygulama bağlantısı kurulamadı.');
      return window.ezwin;
    };

    return {
      createCompany: (input) =>
        runMutation(() => api().company.create(input), 'Şirket oluşturuldu.'),
      updateCompany: (input) => runMutation(() => api().company.update(input), 'Şirket güncellendi.'),
      deleteCompany: (id) => runMutation(() => api().company.remove(id), 'Şirket ve bağlı verileri silindi.'),
      createAsset: (input) => runMutation(() => api().asset.create(input), 'Servis bağlandı.'),
      updateAsset: (input) => runMutation(() => api().asset.update(input), 'Servis güncellendi.'),
      deleteAsset: (id) => runMutation(() => api().asset.remove(id), 'Servis kaldırıldı.'),
      testAsset: async (input) => {
        try {
          return await api().asset.test(input);
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      createTask: (input) => runMutation(() => api().task.create(input)),
      updateTask: (input) => runMutation(() => api().task.update(input)),
      deleteTask: (id) => runMutation(() => api().task.remove(id), 'Görev silindi.'),
      createNote: (input) => runMutation(() => api().note.create(input), 'Not kaydedildi.'),
      updateNote: (input) => runMutation(() => api().note.update(input), 'Not güncellendi.'),
      deleteNote: (id) => runMutation(() => api().note.remove(id), 'Not silindi.'),
      createFinance: (input) => runMutation(() => api().finance.create(input), 'Kayıt eklendi.'),
      deleteFinance: (id) => runMutation(() => api().finance.remove(id), 'Kayıt silindi.'),
      createSalary: (input) =>
        runMutation(() => api().salary.create(input), 'Maaş kaydı eklendi'),
      updateSalary: (input) =>
        runMutation(() => api().salary.update(input), 'Maaş kaydı güncellendi'),
      deleteSalary: (id) => runMutation(() => api().salary.remove(id), 'Maaş kaydı silindi'),
      createInvoice: (input) =>
        runMutation(() => api().invoice.create(input), 'Fatura oluşturuldu'),
      updateInvoice: (input) =>
        runMutation(() => api().invoice.update(input), 'Fatura güncellendi'),
      deleteInvoice: (id) => runMutation(() => api().invoice.remove(id), 'Fatura silindi'),
      createCustomerPayment: (input) =>
        runMutation(() => api().customerPayment.create(input), 'Ödeme kaydedildi'),
      updateCustomerPayment: (input) =>
        runMutation(() => api().customerPayment.update(input), 'Ödeme güncellendi'),
      deleteCustomerPayment: (id) =>
        runMutation(() => api().customerPayment.remove(id), 'Ödeme silindi'),
      createSubscription: (input) =>
        runMutation(() => api().subscription.create(input), 'Abonelik eklendi'),
      updateSubscription: (input) =>
        runMutation(() => api().subscription.update(input), 'Abonelik güncellendi'),
      deleteSubscription: (id) =>
        runMutation(() => api().subscription.remove(id), 'Abonelik silindi'),
      createChatThread: (input) =>
        runMutation(() => api().chat.createThread(input), 'Sohbet açıldı'),
      deleteChatThread: (id) =>
        runMutation(() => api().chat.removeThread(id), 'Sohbet silindi'),
      sendChatMessage: (input) =>
        runMutation(() => api().chat.sendMessage(input), 'Mesaj kaydedildi'),
      deleteChatMessage: (id) =>
        runMutation(() => api().chat.removeMessage(id), 'Mesaj silindi'),
      createAnnouncement: (input) =>
        runMutation(() => api().announcement.create(input), 'Duyuru oluşturuldu'),
      updateAnnouncement: (input) =>
        runMutation(() => api().announcement.update(input), 'Duyuru güncellendi'),
      deleteAnnouncement: (id) =>
        runMutation(() => api().announcement.remove(id), 'Duyuru silindi'),
      createMeeting: (input) =>
        runMutation(() => api().meeting.create(input), 'Toplantı planlandı'),
      updateMeeting: (input) =>
        runMutation(() => api().meeting.update(input), 'Toplantı güncellendi'),
      deleteMeeting: (id) =>
        runMutation(() => api().meeting.remove(id), 'Toplantı silindi'),
      markNotificationsRead: (ids) =>
        runMutation(() => api().notification.markRead(ids)),
      createClient: (input) =>
        runMutation(() => api().client.create(input), 'Müşteri eklendi'),
      updateClient: (input) =>
        runMutation(() => api().client.update(input), 'Müşteri güncellendi'),
      deleteClient: (id) => runMutation(() => api().client.remove(id), 'Müşteri silindi'),
      createContract: (input) =>
        runMutation(() => api().contract.create(input), 'Sözleşme eklendi'),
      updateContract: (input) =>
        runMutation(() => api().contract.update(input), 'Sözleşme güncellendi'),
      deleteContract: (id) => runMutation(() => api().contract.remove(id), 'Sözleşme silindi'),
      createDocument: (input) =>
        runMutation(() => api().document.create(input), 'Belge kaydedildi'),
      updateDocument: (input) =>
        runMutation(() => api().document.update(input), 'Belge güncellendi'),
      deleteDocument: (id) => runMutation(() => api().document.remove(id), 'Belge silindi'),
      createBug: (input) => runMutation(() => api().bug.create(input), 'Hata kaydı açıldı'),
      updateBug: (input) => runMutation(() => api().bug.update(input), 'Hata kaydı güncellendi'),
      deleteBug: (id) => runMutation(() => api().bug.remove(id), 'Hata kaydı silindi'),
      createAutomationRule: (input) =>
        runMutation(() => api().automation.create(input), 'Otomasyon kuralı oluşturuldu'),
      updateAutomationRule: (input) =>
        runMutation(() => api().automation.update(input), 'Otomasyon kuralı güncellendi'),
      deleteAutomationRule: (id) =>
        runMutation(() => api().automation.remove(id), 'Otomasyon kuralı silindi'),
      runAutomationRule: (id) =>
        runMutation(() => api().automation.run(id), 'Otomasyon çalıştırıldı; görev oluşturuldu'),
      logSecurityEvent: async (input) => {
        try {
          const next = await api().security.log(input);
          setData(next);
          return true;
        } catch (err) {
          toast('error', errorMessage(err));
          return false;
        }
      },
      clearSecurityEvents: async () => {
        try {
          const next = await api().security.clear();
          setData(next);
          return true;
        } catch (err) {
          toast('error', errorMessage(err));
          return false;
        }
      },
      createEmployee: (input) =>
        runMutation(() => api().employee.create(input), 'Çalışan eklendi'),
      updateEmployee: (input) =>
        runMutation(() => api().employee.update(input), 'Çalışan güncellendi'),
      deleteEmployee: (id) => runMutation(() => api().employee.remove(id), 'Çalışan silindi'),
      createDepartment: (input) =>
        runMutation(() => api().department.create(input), 'Departman oluşturuldu'),
      updateDepartment: (input) =>
        runMutation(() => api().department.update(input), 'Departman güncellendi'),
      deleteDepartment: (id) =>
        runMutation(() => api().department.remove(id), 'Departman silindi'),
      createRole: (input) => runMutation(() => api().role.create(input), 'Rol oluşturuldu'),
      updateRole: (input) => runMutation(() => api().role.update(input), 'Rol güncellendi'),
      deleteRole: (id) => runMutation(() => api().role.remove(id), 'Rol silindi'),
      createPerformanceReview: (input) =>
        runMutation(() => api().performanceReview.create(input), 'Değerlendirme eklendi'),
      updatePerformanceReview: (input) =>
        runMutation(() => api().performanceReview.update(input), 'Değerlendirme güncellendi'),
      deletePerformanceReview: (id) =>
        runMutation(() => api().performanceReview.remove(id), 'Değerlendirme silindi'),
      createProject: (input) =>
        runMutation(() => api().project.create(input), 'Proje oluşturuldu'),
      updateProject: (input) =>
        runMutation(() => api().project.update(input), 'Proje güncellendi'),
      deleteProject: (id) => runMutation(() => api().project.remove(id), 'Proje silindi'),
      createApproval: (input) =>
        runMutation(() => api().approval.create(input), 'Onay talebi oluşturuldu'),
      updateApproval: (input) =>
        runMutation(() => api().approval.update(input), 'Onay talebi güncellendi'),
      deleteApproval: (id) => runMutation(() => api().approval.remove(id), 'Onay talebi silindi'),
      decideApproval: (id, status, decision) =>
        runMutation(
          () => api().approval.decide(id, status, decision),
          status === 'approved' ? 'Talep onaylandı' : 'Talep reddedildi',
        ),
      updateSettings: (input) => runMutation(() => api().settings.update(input)),
      addYoutubeKey: (label, key) =>
        runMutation(
          () => api().youtube.addKey(label, key),
          'YouTube API anahtarı kaydedildi.',
        ),
      removeYoutubeKey: (id) =>
        runMutation(() => api().youtube.removeKey(id), 'YouTube API anahtarı kaldırıldı.'),
      setDefaultYoutubeKey: (id) => runMutation(() => api().youtube.setDefaultKey(id)),
      testYoutubeKey: async (input) => {
        try {
          return await api().youtube.testKey(input);
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      addYoutubeChannel: (companyId, url, keyId) =>
        runMutation(
          () => api().youtube.addChannel(companyId, url, keyId),
          'YouTube kanalı bağlandı.',
        ),
      setYoutubeChannelKey: (id, keyId) =>
        runMutation(() => api().youtube.setChannelKey(id, keyId)),
      removeYoutubeChannel: (id) =>
        runMutation(() => api().youtube.removeChannel(id), 'YouTube kanalı kaldırıldı.'),
      refreshYoutube: async () => {
        try {
          const next = await api().youtube.refresh();
          setData(next);
          return true;
        } catch (err) {
          toast('error', errorMessage(err));
          return false;
        }
      },
      refreshMonitor: async () => {
        try {
          const next = await api().monitor.refresh();
          setData(next);
          return true;
        } catch (err) {
          toast('error', errorMessage(err));
          return false;
        }
      },
      addConnection: (input) =>
        runMutation(() => api().connections.add(input), 'Hesap eklendi; jeton gerçek API ile kontrol edildi.'),
      verifyConnection: (id) => runMutation(() => api().connections.verify(id)),
      refreshConnection: (id) => runMutation(() => api().connections.refresh(id)),
      primaryConnection: (id) => runMutation(() => api().connections.primary(id)),
      removeConnection: (id) =>
        runMutation(() => api().connections.remove(id), 'Bağlantı kaldırıldı.'),
      importMusic: async () => {
        try {
          const result = await api().music.import();
          setData(result.state);
          if (result.added > 0) {
            toast('success', `${result.added} parça listeye eklendi.`);
          }
          if (result.skipped.length > 0) {
            toast('info', `${result.skipped.length} dosya atlandı (ses değil ya da çok büyük).`);
          }
          return { added: result.added, skipped: result.skipped };
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      removeTrack: (id) => runMutation(() => api().music.remove(id), 'Parça listeden çıkarıldı.'),
      updateTrack: (input) => runMutation(() => api().music.rename(input)),
      translateText: async (input) => {
        try {
          return await api().translate.run(input);
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      markNotesSeen: (version) => runMutation(() => api().updates.markSeen(version)),
      saveUpdateSettings: (input) =>
        runMutation(() => api().updates.saveSettings(input), 'Güncelleme ayarları kaydedildi.'),
      checkUpdates: async () => {
        try {
          return await api().updates.check();
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      installUpdate: async () => {
        try {
          const result = await api().updates.download();
          await api().updates.install();
          toast('success', `v${result.version} indirildi; kurulum başlatıldı.`);
          return true;
        } catch (err) {
          toast('error', errorMessage(err));
          return false;
        }
      },
      lockApp: async () => {
        try {
          await api().session.logout();
        } catch {
          /* kilit her durumda uygulanır */
        }
        window.location.reload();
      },
      openExternal: async (url) => {
        try {
          await api().app.openExternal(url);
        } catch (err) {
          toast('error', errorMessage(err));
        }
      },
      updateAccountProfile: async (input) => {
        try {
          return await api().session.update(input);
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      changePassword: async (input) => {
        try {
          const result = await api().session.changePassword(input);
          toast('success', 'Şifre güncellendi.');
          return result;
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      updateAccountSecurity: async (input) => {
        try {
          return await api().session.security(input);
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
      askAssistant: async (input) => {
        try {
          const result = await api().assistant.ask(input);
          if (result.state) setData(result.state);
          return result;
        } catch (err) {
          toast('error', errorMessage(err));
          return null;
        }
      },
    };
  }, [runMutation, toast]);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setConfirmState({ ...options, resolve });
      }),
    [],
  );

  const closeConfirm = (result: boolean) => {
    if (confirmState) confirmState.resolve(result);
    setConfirmState(null);
  };

  const value = useMemo<AppContextValue>(
    () => ({
      loading,
      fatalError,
      data,
      meta,
      rates,
      ratesLoading,
      ratesError,
      language,
      setLanguage,
      refreshRates,
      actions,
      toast,
      confirm,
    }),
    [
      loading,
      fatalError,
      data,
      meta,
      rates,
      ratesLoading,
      ratesError,
      language,
      setLanguage,
      refreshRates,
      actions,
      toast,
      confirm,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" aria-live="polite">
          {toasts.map((item) => (
            <div key={item.id} className={`toast toast-${item.kind}`}>
              <span className="toast-icon">
                {item.kind === 'success' ? (
                  <CheckCircle2 size={16} />
                ) : item.kind === 'error' ? (
                  <XCircle size={16} />
                ) : (
                  <Info size={16} />
                )}
              </span>
              <span>{item.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== item.id))}
                aria-label={tGlobal('Bildirimi kapat')}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        confirmLabel={confirmState?.confirmLabel ?? 'Sil'}
        danger={confirmState?.danger ?? true}
        onConfirm={() => closeConfirm(true)}
        onCancel={() => closeConfirm(false)}
      />
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp, AppProvider içinde kullanılmalı.');
  return context;
}

export function useAppData(): AppData {
  const { data } = useApp();
  if (!data) throw new Error('Veri henüz yüklenmedi.');
  return data;
}

export type { AppActions, ConfirmOptions, ToastKind };
