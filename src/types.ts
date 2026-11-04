export type Currency = 'TRY' | 'USD' | 'EUR';
export type AssetType = 'discord' | 'pterodactyl' | 'website';
export type ServiceState = 'online' | 'degraded' | 'offline' | 'unchecked';
export type CompanyHealthState = 'working' | 'partial' | 'broken' | 'none' | 'unchecked';
export type TaskPriority = 'low' | 'med' | 'high';
export type FinanceKind = 'income' | 'expense';
export type CompanyStatus = 'active' | 'maintenance' | 'paused';
export type CompanyCategory = 'studio' | 'platform' | 'game' | 'agency' | 'store' | 'music' | 'other';
export type LanguageCode = 'tr' | 'en' | 'de' | 'es' | 'fr' | 'pt' | 'ru' | 'ar' | 'zh' | 'ja';

export interface LinkItem {
  id: string;
  label: string;
  url: string;
}

export interface Company {
  id: string;
  name: string;
  color: string;
  logo?: string | null;
  description: string;
  status: CompanyStatus;
  category: CompanyCategory;
  monthlyTarget: number | null;
  links: LinkItem[];
  createdAt: number;
}

export interface Asset {
  id: string;
  companyId: string;
  type: AssetType;
  name: string;
  config: { url?: string; baseUrl?: string };
  createdAt: number;
  hasSecret: boolean;
  secretHint: string | null;
}

export type MailboxKind = 'inbox' | 'all' | 'starred' | 'sent';
export type MailFilter = 'all' | 'unread' | 'starred' | 'attachments';

export interface MailAccount {
  id: string;
  label: string;
  email: string;
  provider: 'gmail';
  color: string;
  createdAt: number;
  lastSyncAt: number | null;
  lastError: string | null;
  hasSecret?: boolean;
  secretHint?: string | null;
}

export interface MailAddress {
  name: string;
  address: string;
}

export interface MailAttachment {
  filename: string;
  size: number | null;
  contentType: string;
}

export interface MailSummary {
  uid: number;
  accountId: string;
  mailbox: string;
  subject: string;
  from: MailAddress[];
  date: string | null;
  unread: boolean;
  starred: boolean;
  hasAttachments: boolean;
  size: number | null;
}

export interface MailMessage extends MailSummary {
  to: MailAddress[];
  cc: MailAddress[];
  text: string;
  truncated?: boolean;
  attachments: MailAttachment[];
}

export interface MailAccountError {
  accountId: string;
  email: string;
  message: string;
}

export interface MailListInput {
  accountId?: string | null;
  mailbox?: MailboxKind;
  filter?: MailFilter;
  query?: string;
  limit?: number;
}

export interface MailListResult {
  messages: MailSummary[];
  accounts: MailAccount[];
  errors: MailAccountError[];
  unreadCounts: Record<string, number>;
}

export interface MailAddInput {
  label?: string;
  email: string;
  password: string;
}

export interface MailUpdateInput {
  id: string;
  label?: string;
  color?: string;
  password?: string;
}

export interface MailTestInput {
  email: string;
  password: string;
}

export interface MailTestResult {
  ok: boolean;
  message: string;
}

export interface MailReadInput {
  accountId: string;
  uid: number;
  mailbox: string;
}

export interface MailStarInput {
  accountId: string;
  uid: number;
  mailbox: string;
  starred: boolean;
}

export interface YoutubeKeyState {
  hasKey: boolean;
  hint: string | null;
}

export interface YoutubeKey {
  id: string;
  label: string;
  isDefault: boolean;
  hasKey: boolean;
  hint: string | null;
  channelCount: number;
  createdAt: number;
  lastTestedAt: number | null;
  lastError: string | null;
}

export interface YoutubeComment {
  id: string;
  author: string;
  text: string;
  publishedAt: string | null;
  likeCount: number | null;
  videoId: string | null;
  videoTitle: string | null;
}

export type YoutubeCommentsScope = 'channel' | 'videos' | null;

export interface YoutubeChannel {
  id: string;
  companyId: string;
  channelId: string;
  keyId: string | null;
  handle: string | null;
  title: string;
  avatar: string | null;
  subscribers: number | null;
  hiddenSubscribers: boolean;
  views: number | null;
  videos: number | null;
  commentsScope: YoutubeCommentsScope;
  recentComments: YoutubeComment[];
  lastCheckedAt: number | null;
  lastError: string | null;
  commentsError: string | null;
  createdAt: number;
}

export type YoutubeEventKind = 'comment' | 'subscriber';

export interface YoutubeEvent {
  id: string;
  companyId: string;
  channelId: string;
  channelTitle: string;
  kind: YoutubeEventKind;
  at: number;
  author: string | null;
  text: string | null;
  videoId: string | null;
  videoTitle: string | null;
  count: number | null;
}

export interface YoutubeUpdate {
  channels: YoutubeChannel[];
  events: YoutubeEvent[];
  newEvents: YoutubeEvent[];
}

export interface YoutubeTestResult {
  ok: boolean;
  message: string;
}

export interface Task {
  id: string;
  title: string;
  companyId: string | null;
  priority: TaskPriority;
  due: string | null;
  done: boolean;
  createdAt: number;
  completedAt?: number | null;
}

export type EmployeeStatus = 'active' | 'on_leave' | 'inactive';

export interface Employee {
  id: string;
  companyId: string;
  name: string;
  role: string;
  email: string;
  status: EmployeeStatus;
  startDate: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ProjectStatus = 'active' | 'paused' | 'completed';

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  dueDate: string | null;
  createdAt: number;
  updatedAt: number;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  companyId: string;
  title: string;
  requestedBy: string;
  amount: number | null;
  note: string;
  status: ApprovalStatus;
  createdAt: number;
  decidedAt: number | null;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  companyId: string | null;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FinanceEntry {
  id: string;
  companyId: string;
  kind: FinanceKind;
  amount: number;
  category: string;
  note: string;
  date: string;
  createdAt: number;
}

export interface HistoryPoint {
  t: number;
  ok: boolean;
  ms: number | null;
}

export interface Guild {
  id: string;
  name: string;
}

export interface PanelServer {
  id: string;
  name: string;
  state: string;
  cpuPercent: number | null;
  memoryMb: number | null;
  memoryLimitMb: number | null;
  diskMb: number | null;
  diskLimitMb: number | null;
  uptimeMs: number | null;
}

export interface ServiceStatus {
  assetId: string;
  checkedAt: number;
  state: 'online' | 'degraded' | 'offline';
  latencyMs: number | null;
  summary: string;
  error: string | null;
  website?: {
    statusCode: number | null;
    sslExpiresAt: number | null;
    history: HistoryPoint[];
  };
  discord?: {
    botId: string;
    username: string;
    guildCount?: number;
    guilds: Guild[];
  };
  pterodactyl?: {
    account: string | null;
    total: number;
    servers: PanelServer[];
  };
}

export type ClockFormat = '24h' | '12h';
export type StartPage =
  | 'dashboard'
  | 'services'
  | 'companies'
  | 'operations'
  | 'mail'
  | 'finance'
  | 'tasks'
  | 'tools';
export type AppTheme = 'night' | 'violet' | 'ice' | 'lime';

export type ConnectionPlatform = 'youtube' | 'instagram' | 'tiktok';
export type ConnectionStatus = 'active' | 'unverified' | 'needs_attention';

export interface Connection {
  id: string;
  platform: ConnectionPlatform;
  label: string;
  externalId: string | null;
  handle: string | null;
  avatar: string | null;
  status: ConnectionStatus;
  lastError: string | null;
  expiresAt: number | null;
  isPrimary: boolean;
  meta: Record<string, string | number | null>;
  createdAt: number;
  updatedAt: number;
  hasToken: boolean;
  tokenHint: string | null;
}

export interface PlatformInfo {
  id: ConnectionPlatform;
  label: string;
  color: string;
  hint: string;
  docsUrl: string;
  scopes: string;
  steps: string[];
  exampleToken: string;
  exampleRefresh: string | null;
  tokenPrefix: string | null;
  note: string | null;
}

export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  mime: string;
  size: number;
  addedAt: number;
  src: string;
}

export type AutoLockMinutes = 0 | 5 | 15 | 30 | 60;

export interface AccountSecurity {
  autoLockMinutes: AutoLockMinutes;
  lockOnBlur: boolean;
  rememberDefault: boolean;
}

export interface AccountInfo {
  id: string;
  email: string;
  name: string;
  color: string;
  avatar: string | null;
  createdAt: number;
  lastLoginAt: number | null;
  passwordChangedAt: number | null;
  hasPassword: boolean;
  passwordScore: number;
  security: AccountSecurity;
  securityScore: number;
  twoFactorEnabled: boolean;
  twoFactorEnabledAt: number | null;
  backupCodesRemaining: number;
}

export interface SessionPayload {
  account: AccountInfo | null;
  accounts: AccountInfo[];
  locked: boolean;
  meta: Meta;
}

export interface AuthResult {
  account: AccountInfo;
  accounts: AccountInfo[];
}

export interface TwoFactorPending {
  requires2fa: true;
  challengeId: string;
  email: string;
  name: string;
  expiresIn: number;
}

export type LoginResult = AuthResult | TwoFactorPending;

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
  account: AccountInfo;
}

export interface TwoFactorEnableResult extends AuthResult {
  backupCodes: string[];
}

export interface TwoFactorCodeInput {
  password: string;
  code: string;
}

export interface UpdateProfileInput {
  name?: string;
  color?: string;
  avatar?: string | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  nextPassword: string;
}

export interface UpdateSecurityInput {
  autoLockMinutes?: AutoLockMinutes;
  lockOnBlur?: boolean;
  rememberDefault?: boolean;
}

export interface AssistantSuggestion {
  text: string;
}

export interface AssistantReply {
  reply: string;
  source: 'local' | 'model';
  suggestions: string[];
  navigate: string | null;
  mutated: boolean;
  state?: AppData;
}

export interface AssistantStatus {
  provider: string;
  endpoint: string;
  model: string;
  modelLabel: string;
  hasKey: boolean;
  ready: boolean;
}

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  summary: string;
  items: string[];
}

export interface UpdateNotesPayload {
  currentVersion: string;
  entries: ChangelogEntry[];
  lastSeenVersion: string | null;
  feedUrl: string;
  autoUpdate: boolean;
}

export interface UpdateCheck {
  configured: boolean;
  available: boolean;
  currentVersion: string;
  latest?: string;
  url?: string | null;
  sha256?: string | null;
  notes?: string[];
  publishedAt?: string | null;
  checkedAt?: number;
  message: string;
}

export interface TranslationResult {
  text: string;
  engine: string;
}

export interface AddConnectionInput {
  platform: ConnectionPlatform;
  token: string;
  refreshToken?: string;
  label?: string;
}

export interface Settings {
  currency: Currency;
  pollIntervalSec: number;
  openAtLogin: boolean;
  language: LanguageCode;
  clockFormat: ClockFormat;
  showSeconds: boolean;
  startPage: StartPage;
  notifications: boolean;
  theme: AppTheme;
  maximized: boolean;
  reduceMotion: boolean;
  autoUpdate: boolean;
  updateFeedUrl: string;
  lastSeenVersion: string | null;
  translateSource: string;
  translateTarget: string;
  musicVolume: number;
}

export interface RatesPayload {
  base: 'USD';
  rates: { TRY: number; EUR: number };
  fetchedAt: number;
  rateDate: string | null;
  source: string;
  stale: boolean;
  error?: string | null;
}

export interface AppData {
  version: number;
  companies: Company[];
  assets: Asset[];
  mailAccounts: MailAccount[];
  youtubeChannels: YoutubeChannel[];
  youtubeEvents: YoutubeEvent[];
  youtubeKey: YoutubeKeyState;
  youtubeKeys: YoutubeKey[];
  tasks: Task[];
  notes: Note[];
  finance: FinanceEntry[];
  employees: Employee[];
  projects: Project[];
  approvals: Approval[];
  connections: Connection[];
  playlist: PlaylistTrack[];
  settings: Settings;
  statuses: Record<string, ServiceStatus>;
}

export interface Meta {
  appVersion: string;
  secureStorage: boolean;
  dataPath: string;
  platform: string;
}

export interface InitialPayload {
  state: AppData;
  meta: Meta;
}

export interface TestResult {
  ok: boolean;
  state?: ServiceState;
  message: string;
  result?: ServiceStatus;
}

export interface AssetTestInput {
  type: AssetType;
  config: { url?: string; baseUrl?: string };
  secret?: string;
  assetId?: string;
}

export interface CreateAssetInput {
  companyId: string;
  type: AssetType;
  name: string;
  config: { url?: string; baseUrl?: string };
  secret?: string;
}

export interface UpdateAssetInput {
  id: string;
  name?: string;
  companyId?: string;
  config?: { url?: string; baseUrl?: string };
  secret?: string;
}

export interface CreateCompanyInput {
  name: string;
  color?: string;
  logo?: string | null;
  description?: string;
  status?: CompanyStatus;
  category?: CompanyCategory;
  monthlyTarget?: number | null;
  links?: LinkItem[];
}

export interface UpdateCompanyInput {
  id: string;
  name?: string;
  color?: string;
  logo?: string | null;
  description?: string;
  status?: CompanyStatus;
  category?: CompanyCategory;
  monthlyTarget?: number | null;
  links?: LinkItem[];
}

export interface CreateTaskInput {
  title: string;
  companyId?: string | null;
  priority?: TaskPriority;
  due?: string | null;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  companyId?: string | null;
  priority?: TaskPriority;
  due?: string | null;
  done?: boolean;
}

export interface CreateEmployeeInput {
  companyId: string;
  name: string;
  role?: string;
  email?: string;
  status?: EmployeeStatus;
  startDate?: string | null;
}

export interface UpdateEmployeeInput {
  id: string;
  companyId?: string;
  name?: string;
  role?: string;
  email?: string;
  status?: EmployeeStatus;
  startDate?: string | null;
}

export interface CreateProjectInput {
  companyId: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  progress?: number;
  dueDate?: string | null;
}

export interface UpdateProjectInput {
  id: string;
  companyId?: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
  progress?: number;
  dueDate?: string | null;
}

export interface CreateApprovalInput {
  companyId: string;
  title: string;
  requestedBy?: string;
  amount?: number | null;
  note?: string;
}

export interface UpdateApprovalInput {
  id: string;
  companyId?: string;
  title?: string;
  requestedBy?: string;
  amount?: number | null;
  note?: string;
}

export interface CreateNoteInput {
  title?: string;
  body?: string;
  companyId?: string | null;
  pinned?: boolean;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  body?: string;
  companyId?: string | null;
  pinned?: boolean;
}

export interface CreateFinanceInput {
  companyId: string;
  kind: FinanceKind;
  amount: number;
  category?: string;
  note?: string;
  date: string;
}

export interface UpdateSettingsInput {
  currency?: Currency;
  pollIntervalSec?: number;
  openAtLogin?: boolean;
  language?: LanguageCode;
  clockFormat?: ClockFormat;
  showSeconds?: boolean;
  startPage?: StartPage;
  notifications?: boolean;
  theme?: AppTheme;
  maximized?: boolean;
  reduceMotion?: boolean;
  autoUpdate?: boolean;
  updateFeedUrl?: string;
  translateSource?: string;
  translateTarget?: string;
  musicVolume?: number;
}

export interface ExportResult {
  canceled: boolean;
  path: string | null;
}

export interface EzwinApi {
  getInitial: () => Promise<InitialPayload>;
  company: {
    create: (input: CreateCompanyInput) => Promise<AppData>;
    update: (input: UpdateCompanyInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
  };
  asset: {
    create: (input: CreateAssetInput) => Promise<AppData>;
    update: (input: UpdateAssetInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
    test: (input: AssetTestInput) => Promise<TestResult>;
  };
  task: {
    create: (input: CreateTaskInput) => Promise<AppData>;
    update: (input: UpdateTaskInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
  };
  note: {
    create: (input: CreateNoteInput) => Promise<AppData>;
    update: (input: UpdateNoteInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
  };
  finance: {
    create: (input: CreateFinanceInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
  };
  employee: {
    create: (input: CreateEmployeeInput) => Promise<AppData>;
    update: (input: UpdateEmployeeInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
  };
  project: {
    create: (input: CreateProjectInput) => Promise<AppData>;
    update: (input: UpdateProjectInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
  };
  approval: {
    create: (input: CreateApprovalInput) => Promise<AppData>;
    update: (input: UpdateApprovalInput) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
    decide: (id: string, status: Exclude<ApprovalStatus, 'pending'>) => Promise<AppData>;
  };
  settings: {
    update: (input: UpdateSettingsInput) => Promise<AppData>;
    testNotification: () => Promise<boolean>;
  };
  mail: {
    accounts: () => Promise<MailAccount[]>;
    test: (input: MailTestInput) => Promise<MailTestResult>;
    add: (input: MailAddInput) => Promise<MailAccount[]>;
    update: (input: MailUpdateInput) => Promise<MailAccount[]>;
    remove: (id: string) => Promise<MailAccount[]>;
    list: (input: MailListInput) => Promise<MailListResult>;
    read: (input: MailReadInput) => Promise<MailMessage>;
    star: (input: MailStarInput) => Promise<boolean>;
  };
  youtube: {
    addKey: (label: string, key: string) => Promise<AppData>;
    updateKey: (id: string, label: string) => Promise<AppData>;
    removeKey: (id: string) => Promise<AppData>;
    setDefaultKey: (id: string) => Promise<AppData>;
    testKey: (input?: { id?: string; key?: string }) => Promise<YoutubeTestResult>;
    addChannel: (companyId: string, url: string, keyId?: string) => Promise<AppData>;
    setChannelKey: (id: string, keyId: string) => Promise<AppData>;
    removeChannel: (id: string) => Promise<AppData>;
    refresh: () => Promise<AppData>;
  };
  monitor: {
    refresh: () => Promise<AppData>;
  };
  session: {
    get: () => Promise<SessionPayload>;
    register: (input: {
      email: string;
      password: string;
      name: string;
      remember?: boolean;
    }) => Promise<AuthResult>;
    login: (input: {
      email: string;
      password: string;
      remember?: boolean;
    }) => Promise<LoginResult>;
    verify2fa: (input: { challengeId: string; code: string }) => Promise<AuthResult>;
    setup2fa: () => Promise<TwoFactorSetup>;
    enable2fa: (input: { code: string }) => Promise<TwoFactorEnableResult>;
    disable2fa: (input: TwoFactorCodeInput) => Promise<AuthResult>;
    backup2fa: (input: TwoFactorCodeInput) => Promise<TwoFactorEnableResult>;
    logout: () => Promise<{ locked: boolean; accounts: AccountInfo[] }>;
    update: (input: UpdateProfileInput) => Promise<AuthResult>;
    changePassword: (input: ChangePasswordInput) => Promise<AuthResult>;
    security: (input: UpdateSecurityInput) => Promise<AuthResult>;
  };
  assistant: {
    status: () => Promise<AssistantStatus>;
    ask: (input: {
      message: string;
      history?: AssistantMessage[];
    }) => Promise<AssistantReply>;
  };
  connections: {
    platforms: () => Promise<PlatformInfo[]>;
    add: (input: AddConnectionInput) => Promise<AppData>;
    verify: (id: string) => Promise<AppData>;
    refresh: (id: string) => Promise<AppData>;
    primary: (id: string) => Promise<AppData>;
    remove: (id: string) => Promise<AppData>;
  };
  music: {
    import: () => Promise<{ added: number; skipped: string[]; state: AppData }>;
    remove: (id: string) => Promise<AppData>;
    rename: (input: { id: string; title?: string; artist?: string }) => Promise<AppData>;
  };
  translate: {
    languages: () => Promise<{ code: string; name: string }[]>;
    run: (input: { text: string; source: string; target: string }) => Promise<TranslationResult>;
  };
  updates: {
    notes: () => Promise<UpdateNotesPayload>;
    check: () => Promise<UpdateCheck>;
    markSeen: (version: string) => Promise<AppData>;
    saveSettings: (input: { autoUpdate?: boolean; updateFeedUrl?: string }) => Promise<AppData>;
    download: () => Promise<{ file: string; size: number; version: string }>;
    install: () => Promise<{ started: boolean; version: string }>;
  };
  rates: {
    get: () => Promise<RatesPayload>;
    refresh: () => Promise<RatesPayload>;
  };
  app: {
    openExternal: (url: string) => Promise<boolean>;
    exportData: () => Promise<ExportResult>;
    revealData: () => Promise<boolean>;
    copyText: (text: string) => void;
  };
  onStatuses: (callback: (statuses: Record<string, ServiceStatus>) => void) => () => void;
  onYoutube: (callback: (payload: YoutubeUpdate) => void) => () => void;
  onFullscreen: (callback: (fullscreen: boolean) => void) => () => void;
  onMaximized: (callback: (maximized: boolean) => void) => () => void;
  onUpdateAvailable: (callback: (payload: UpdateCheck) => void) => () => void;
}

declare global {
  interface Window {
    ezwin?: EzwinApi;
  }
}
