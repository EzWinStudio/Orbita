'use strict';

const crypto = require('node:crypto');

const ID = () => crypto.randomUUID();

const SALARY_STATUSES = ['planned', 'paid'];
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'canceled'];
const PAYMENT_METHODS = ['transfer', 'card', 'cash', 'other'];
const PAYMENT_STATUSES = ['pending', 'received'];
const SUBSCRIPTION_KINDS = ['subscription', 'license'];
const BILLING_CYCLES = ['monthly', 'yearly'];
const SUBSCRIPTION_STATUSES = ['active', 'paused', 'canceled'];
const CHAT_SCOPES = ['company', 'department', 'direct'];
const ANNOUNCEMENT_AUDIENCES = ['company', 'department'];
const ANNOUNCEMENT_VISIBILITIES = ['team', 'admin'];
const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'archived'];
const ANNOUNCEMENT_PRIORITIES = ['normal', 'important', 'urgent'];
const MEETING_STATUSES = ['planned', 'done', 'canceled'];
const CLIENT_STATUSES = ['lead', 'active', 'paused', 'lost'];
const CONTRACT_STATUSES = ['active', 'pending', 'expired', 'terminated'];
const CONTRACT_KINDS = ['service', 'supplier', 'nda', 'employment', 'other'];
const DOCUMENT_CATEGORIES = ['contract', 'finance', 'hr', 'legal', 'project', 'other'];
const BUG_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const BUG_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const AUTOMATION_CADENCES = ['daily', 'weekly', 'monthly'];
const SECURITY_KINDS = ['role', 'approval', 'backup', 'import', 'security', 'account'];
const TASK_PRIORITIES = ['low', 'med', 'high'];
const EMPLOYEE_STATUSES = ['active', 'on_leave', 'inactive'];
const PROJECT_STATUSES = ['active', 'paused', 'completed'];
const PERMISSION_KEYS = [
  'companies',
  'services',
  'finance',
  'projects',
  'team',
  'approvals',
  'tasks',
  'settings',
];
const DEPARTMENT_COLORS = ['#3ef2b5', '#5fc6ff', '#b98bff', '#ffc857', '#ff8fd8', '#a8ff60', '#ff8a1e', '#9fe8d9'];

const str = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');
const num = (value, fallback = 0) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
};
const amountOf = (value) => Math.round(Math.max(0, num(value, 0)) * 100) / 100;
const dateOf = (value) => {
  const clean = str(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
};
const periodOf = (value) => {
  const clean = str(value, 7);
  return /^\d{4}-\d{2}$/.test(clean) ? clean : null;
};
const pick = (list, value, fallback) => (list.includes(value) ? value : fallback);
const asArray = (value) => (Array.isArray(value) ? value : []);

function registerLocalData({ handle, store, current, findCompany, validId }) {
  const state = () => store.get();
  const find = (list, id, label) => {
    const record = list.find((item) => item.id === String(id || ''));
    if (!record) throw new Error(`${label} bulunamadı.`);
    return record;
  };
  const employeeOf = (id, companyId) => {
    const employee = state().employees.find(
      (item) => item.id === String(id || '') && item.companyId === companyId,
    );
    if (!employee) throw new Error('Çalışan bulunamadı.');
    return employee;
  };
  const departmentOf = (id, companyId) => {
    if (!String(id || '')) return null;
    const department = state().departments.find(
      (item) => item.id === String(id) && item.companyId === companyId,
    );
    if (!department) throw new Error('Departman bulunamadı.');
    return department;
  };
  const invoiceNumber = (issueDate) => {
    const prefix = `FTR-${issueDate.slice(0, 4)}-`;
    let max = 0;
    for (const invoice of state().invoices) {
      if (!invoice.number || !invoice.number.startsWith(prefix)) continue;
      const sequence = Number(invoice.number.slice(prefix.length));
      if (Number.isFinite(sequence)) max = Math.max(max, sequence);
    }
    return `${prefix}${String(max + 1).padStart(4, '0')}`;
  };

  const handlers = {
    salary: {
      create(input) {
        const company = findCompany(input.companyId);
        const employee = employeeOf(input.employeeId, company.id);
        if (!(num(input.amount, -1) > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        const period = periodOf(input.period);
        if (!period) throw new Error('Geçerli bir dönem gir.');
        const status = pick(SALARY_STATUSES, input.status, 'planned');
        const at = Date.now();
        state().salaries.push({
          id: ID(),
          companyId: company.id,
          employeeId: employee.id,
          employeeName: employee.name,
          period,
          amount: amountOf(input.amount),
          status,
          paidAt: status === 'paid' ? at : null,
          note: str(input.note, 500),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const salary = find(state().salaries, input.id, 'Maaş kaydı');
        if (input.employeeId !== undefined) {
          const employee = employeeOf(input.employeeId, salary.companyId);
          salary.employeeId = employee.id;
          salary.employeeName = employee.name;
        }
        if (input.period !== undefined) {
          const period = periodOf(input.period);
          if (!period) throw new Error('Geçerli bir dönem gir.');
          salary.period = period;
        }
        if (input.amount !== undefined) {
          if (!(num(input.amount, -1) > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
          salary.amount = amountOf(input.amount);
        }
        if (input.status !== undefined && SALARY_STATUSES.includes(input.status)) {
          salary.status = input.status;
          salary.paidAt = input.status === 'paid' ? salary.paidAt ?? Date.now() : null;
        }
        if (input.note !== undefined) salary.note = str(input.note, 500);
        salary.updatedAt = Date.now();
      },
      remove(input) {
        find(state().salaries, input.id, 'Maaş kaydı');
        state().salaries = state().salaries.filter((item) => item.id !== input.id);
      },
    },

    invoice: {
      create(input) {
        const company = findCompany(input.companyId);
        const customerName = str(input.customerName, 160);
        if (!customerName) throw new Error('Müşteri adı gerekli.');
        if (!(num(input.amount, -1) > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        const taxRate = Math.min(100, Math.max(0, num(input.taxRate, 0)));
        const issueDate = dateOf(input.issueDate);
        const dueDate = dateOf(input.dueDate);
        if (!issueDate || !dueDate) throw new Error('Geçerli bir tarih gir.');
        if (dueDate < issueDate) throw new Error('Vade tarihi düzenleme tarihinden önce olamaz.');
        const at = Date.now();
        state().invoices.push({
          id: ID(),
          companyId: company.id,
          number: invoiceNumber(issueDate),
          customerName,
          customerEmail: str(input.customerEmail, 160),
          amount: amountOf(input.amount),
          taxRate,
          issueDate,
          dueDate,
          status: pick(INVOICE_STATUSES, input.status, 'sent'),
          note: str(input.note, 1000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const invoice = find(state().invoices, input.id, 'Fatura');
        if (input.companyId !== undefined && input.companyId !== invoice.companyId) {
          const company = findCompany(input.companyId);
          invoice.companyId = company.id;
          for (const payment of state().customerPayments) {
            if (payment.invoiceId === invoice.id) payment.companyId = company.id;
          }
        }
        if (input.customerName !== undefined) {
          const customerName = str(input.customerName, 160);
          if (!customerName) throw new Error('Müşteri adı gerekli.');
          invoice.customerName = customerName;
        }
        if (input.customerEmail !== undefined) invoice.customerEmail = str(input.customerEmail, 160);
        if (input.amount !== undefined) {
          if (!(num(input.amount, -1) > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
          invoice.amount = amountOf(input.amount);
        }
        if (input.taxRate !== undefined) invoice.taxRate = Math.min(100, Math.max(0, num(input.taxRate, invoice.taxRate)));
        if (input.issueDate !== undefined) {
          const issueDate = dateOf(input.issueDate);
          if (!issueDate) throw new Error('Geçerli bir tarih gir.');
          invoice.issueDate = issueDate;
        }
        if (input.dueDate !== undefined) {
          const dueDate = dateOf(input.dueDate);
          if (!dueDate) throw new Error('Geçerli bir tarih gir.');
          invoice.dueDate = dueDate;
        }
        if (invoice.dueDate < invoice.issueDate) {
          throw new Error('Vade tarihi düzenleme tarihinden önce olamaz.');
        }
        if (input.status !== undefined && INVOICE_STATUSES.includes(input.status)) {
          invoice.status = input.status;
        }
        if (input.note !== undefined) invoice.note = str(input.note, 1000);
        invoice.updatedAt = Date.now();
      },
      remove(input) {
        find(state().invoices, input.id, 'Fatura');
        state().invoices = state().invoices.filter((item) => item.id !== input.id);
        state().customerPayments = state().customerPayments.map((payment) =>
          payment.invoiceId === input.id
            ? { ...payment, invoiceId: null, updatedAt: Date.now() }
            : payment,
        );
      },
    },

    customerPayment: {
      create(input) {
        const company = findCompany(input.companyId);
        if (!(num(input.amount, -1) > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
        const date = dateOf(input.date);
        if (!date) throw new Error('Geçerli bir tarih gir.');
        const invoiceId = str(input.invoiceId, 64);
        const invoice = invoiceId
          ? state().invoices.find((item) => item.id === invoiceId && item.companyId === company.id)
          : null;
        if (invoiceId && !invoice) throw new Error('Fatura bulunamadı.');
        const customerName = str(input.customerName, 160) || (invoice ? invoice.customerName : '');
        if (!customerName) throw new Error('Müşteri adı gerekli.');
        const at = Date.now();
        state().customerPayments.push({
          id: ID(),
          companyId: company.id,
          customerName,
          invoiceId: invoice ? invoice.id : null,
          amount: amountOf(input.amount),
          method: pick(PAYMENT_METHODS, input.method, 'transfer'),
          status: pick(PAYMENT_STATUSES, input.status, 'received'),
          date,
          note: str(input.note, 1000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const payment = find(state().customerPayments, input.id, 'Ödeme kaydı');
        if (input.invoiceId !== undefined) {
          const invoiceId = str(input.invoiceId, 64);
          const invoice = invoiceId
            ? state().invoices.find(
                (item) => item.id === invoiceId && item.companyId === payment.companyId,
              )
            : null;
          if (invoiceId && !invoice) throw new Error('Fatura bulunamadı.');
          payment.invoiceId = invoice ? invoice.id : null;
          if (!payment.customerName && invoice) payment.customerName = invoice.customerName;
        }
        if (input.customerName !== undefined) {
          const customerName = str(input.customerName, 160);
          if (!customerName) throw new Error('Müşteri adı gerekli.');
          payment.customerName = customerName;
        }
        if (input.amount !== undefined) {
          if (!(num(input.amount, -1) > 0)) throw new Error('Sıfırdan büyük bir tutar gir.');
          payment.amount = amountOf(input.amount);
        }
        if (input.method !== undefined && PAYMENT_METHODS.includes(input.method)) {
          payment.method = input.method;
        }
        if (input.status !== undefined && PAYMENT_STATUSES.includes(input.status)) {
          payment.status = input.status;
        }
        if (input.date !== undefined) {
          const date = dateOf(input.date);
          if (!date) throw new Error('Geçerli bir tarih gir.');
          payment.date = date;
        }
        if (input.note !== undefined) payment.note = str(input.note, 1000);
        payment.updatedAt = Date.now();
      },
      remove(input) {
        find(state().customerPayments, input.id, 'Ödeme kaydı');
        state().customerPayments = state().customerPayments.filter((item) => item.id !== input.id);
      },
    },

    subscription: {
      create(input) {
        const company = findCompany(input.companyId);
        const name = str(input.name, 160);
        if (!name) throw new Error('Abonelik adı gerekli.');
        const nextRenewal = dateOf(input.nextRenewal);
        if (!nextRenewal) throw new Error('Geçerli bir yenileme tarihi gir.');
        const at = Date.now();
        state().subscriptions.push({
          id: ID(),
          companyId: company.id,
          name,
          vendor: str(input.vendor, 160),
          kind: pick(SUBSCRIPTION_KINDS, input.kind, 'subscription'),
          amount: amountOf(input.amount),
          cycle: pick(BILLING_CYCLES, input.cycle, 'monthly'),
          nextRenewal,
          status: pick(SUBSCRIPTION_STATUSES, input.status, 'active'),
          note: str(input.note, 1000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const subscription = find(state().subscriptions, input.id, 'Abonelik');
        if (input.companyId !== undefined) {
          subscription.companyId = findCompany(input.companyId).id;
        }
        if (input.name !== undefined) {
          const name = str(input.name, 160);
          if (!name) throw new Error('Abonelik adı gerekli.');
          subscription.name = name;
        }
        if (input.vendor !== undefined) subscription.vendor = str(input.vendor, 160);
        if (input.kind !== undefined && SUBSCRIPTION_KINDS.includes(input.kind)) {
          subscription.kind = input.kind;
        }
        if (input.amount !== undefined) subscription.amount = amountOf(input.amount);
        if (input.cycle !== undefined && BILLING_CYCLES.includes(input.cycle)) {
          subscription.cycle = input.cycle;
        }
        if (input.nextRenewal !== undefined) {
          const nextRenewal = dateOf(input.nextRenewal);
          if (!nextRenewal) throw new Error('Geçerli bir yenileme tarihi gir.');
          subscription.nextRenewal = nextRenewal;
        }
        if (input.status !== undefined && SUBSCRIPTION_STATUSES.includes(input.status)) {
          subscription.status = input.status;
        }
        if (input.note !== undefined) subscription.note = str(input.note, 1000);
        subscription.updatedAt = Date.now();
      },
      remove(input) {
        find(state().subscriptions, input.id, 'Abonelik');
        state().subscriptions = state().subscriptions.filter((item) => item.id !== input.id);
      },
    },

    chat: {
      createThread(input) {
        const company = findCompany(input.companyId);
        if (!CHAT_SCOPES.includes(input.scope)) throw new Error('Bilinmeyen sohbet türü.');
        const departmentId = input.scope === 'department' ? str(input.departmentId, 64) : '';
        const employeeId = input.scope === 'direct' ? str(input.employeeId, 64) : '';
        if (input.scope === 'department') departmentOf(departmentId, company.id);
        if (input.scope === 'direct') employeeOf(employeeId, company.id);
        const duplicate = state().chatThreads.some(
          (thread) =>
            thread.companyId === company.id &&
            thread.scope === input.scope &&
            (input.scope !== 'department' || thread.departmentId === departmentId) &&
            (input.scope !== 'direct' || thread.employeeId === employeeId),
        );
        if (duplicate) throw new Error('Bu sohbet zaten açık.');
        const at = Date.now();
        state().chatThreads.push({
          id: ID(),
          companyId: company.id,
          scope: input.scope,
          departmentId: departmentId || null,
          employeeId: employeeId || null,
          createdAt: at,
          updatedAt: at,
        });
      },
      removeThread(input) {
        find(state().chatThreads, input.id, 'Sohbet');
        state().chatThreads = state().chatThreads.filter((item) => item.id !== input.id);
        state().chatMessages = state().chatMessages.filter((item) => item.threadId !== input.id);
      },
      sendMessage(input) {
        const thread = find(state().chatThreads, input.threadId, 'Sohbet');
        const body = str(input.body, 4000);
        if (!body) throw new Error('Mesaj boş olamaz.');
        const at = Date.now();
        state().chatMessages.push({
          id: ID(),
          threadId: thread.id,
          author: str(input.author, 80),
          body,
          createdAt: at,
        });
        thread.updatedAt = at;
      },
      removeMessage(input) {
        find(state().chatMessages, input.id, 'Mesaj');
        state().chatMessages = state().chatMessages.filter((item) => item.id !== input.id);
      },
    },

    announcement: {
      create(input) {
        const company = findCompany(input.companyId);
        const title = str(input.title, 160);
        const body = str(input.body, 8000);
        if (!title) throw new Error('Duyuru başlığı gerekli.');
        if (!body) throw new Error('Duyuru metni gerekli.');
        const audience = pick(ANNOUNCEMENT_AUDIENCES, input.audience, 'company');
        const departmentId = audience === 'department' ? str(input.departmentId, 64) : '';
        if (audience === 'department') departmentOf(departmentId, company.id);
        const status = pick(ANNOUNCEMENT_STATUSES, input.status, 'draft');
        const at = Date.now();
        state().announcements.push({
          id: ID(),
          companyId: company.id,
          departmentId: departmentId || null,
          title,
          body,
          audience,
          visibility: pick(ANNOUNCEMENT_VISIBILITIES, input.visibility, 'team'),
          priority: pick(ANNOUNCEMENT_PRIORITIES, input.priority, 'normal'),
          pinned: input.pinned === true,
          status,
          author: str(input.author, 80),
          publishedAt: status === 'published' ? at : null,
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const announcement = find(state().announcements, input.id, 'Duyuru');
        if (input.companyId !== undefined) {
          announcement.companyId = findCompany(input.companyId).id;
        }
        if (input.title !== undefined) {
          const title = str(input.title, 160);
          if (!title) throw new Error('Duyuru başlığı gerekli.');
          announcement.title = title;
        }
        if (input.body !== undefined) {
          const body = str(input.body, 8000);
          if (!body) throw new Error('Duyuru metni gerekli.');
          announcement.body = body;
        }
        if (input.audience !== undefined && ANNOUNCEMENT_AUDIENCES.includes(input.audience)) {
          announcement.audience = input.audience;
        }
        if (input.departmentId !== undefined) {
          const departmentId = str(input.departmentId, 64);
          if (departmentId) departmentOf(departmentId, announcement.companyId);
          announcement.departmentId = departmentId || null;
        }
        if (
          announcement.audience === 'department' &&
          (!announcement.departmentId ||
            !state().departments.some(
              (item) =>
                item.id === announcement.departmentId &&
                item.companyId === announcement.companyId,
            ))
        ) {
          throw new Error('Departman bulunamadı.');
        }
        if (
          input.visibility !== undefined &&
          ANNOUNCEMENT_VISIBILITIES.includes(input.visibility)
        ) {
          announcement.visibility = input.visibility;
        }
        if (input.priority !== undefined && ANNOUNCEMENT_PRIORITIES.includes(input.priority)) {
          announcement.priority = input.priority;
        }
        if (input.pinned !== undefined) announcement.pinned = input.pinned === true;
        if (input.status !== undefined && ANNOUNCEMENT_STATUSES.includes(input.status)) {
          if (input.status === 'published' && announcement.status !== 'published') {
            announcement.publishedAt = Date.now();
          }
          if (input.status !== 'published') announcement.publishedAt = null;
          announcement.status = input.status;
        }
        if (input.author !== undefined) announcement.author = str(input.author, 80);
        announcement.updatedAt = Date.now();
      },
      remove(input) {
        find(state().announcements, input.id, 'Duyuru');
        state().announcements = state().announcements.filter((item) => item.id !== input.id);
      },
    },

    meeting: {
      create(input) {
        const company = findCompany(input.companyId);
        const title = str(input.title, 160);
        if (!title) throw new Error('Toplantı başlığı gerekli.');
        const date = dateOf(input.date);
        if (!date) throw new Error('Geçerli bir tarih gir.');
        const time = str(input.time, 5);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Geçerli bir saat gir.');
        const departmentId = str(input.departmentId, 64);
        if (departmentId) departmentOf(departmentId, company.id);
        const attendeeIds = Array.from(
          new Set(
            asArray(input.attendeeIds).filter((employeeId) =>
              state().employees.some(
                (employee) =>
                  employee.id === employeeId && employee.companyId === company.id,
              ),
            ),
          ),
        );
        const at = Date.now();
        state().meetings.push({
          id: ID(),
          companyId: company.id,
          departmentId: departmentId || null,
          title,
          agenda: str(input.agenda, 4000),
          date,
          time,
          durationMin: Math.min(480, Math.max(5, num(input.durationMin, 30))),
          location: str(input.location, 200),
          attendeeIds,
          status: pick(MEETING_STATUSES, input.status, 'planned'),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const meeting = find(state().meetings, input.id, 'Toplantı');
        if (input.companyId !== undefined) {
          meeting.companyId = findCompany(input.companyId).id;
          meeting.attendeeIds = meeting.attendeeIds.filter((employeeId) =>
            state().employees.some(
              (employee) => employee.id === employeeId && employee.companyId === meeting.companyId,
            ),
          );
        }
        if (input.title !== undefined) {
          const title = str(input.title, 160);
          if (!title) throw new Error('Toplantı başlığı gerekli.');
          meeting.title = title;
        }
        if (input.agenda !== undefined) meeting.agenda = str(input.agenda, 4000);
        if (input.date !== undefined) {
          const date = dateOf(input.date);
          if (!date) throw new Error('Geçerli bir tarih gir.');
          meeting.date = date;
        }
        if (input.time !== undefined) {
          const time = str(input.time, 5);
          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Geçerli bir saat gir.');
          meeting.time = time;
        }
        if (input.durationMin !== undefined) {
          meeting.durationMin = Math.min(480, Math.max(5, num(input.durationMin, 30)));
        }
        if (input.location !== undefined) meeting.location = str(input.location, 200);
        if (input.departmentId !== undefined) {
          const departmentId = str(input.departmentId, 64);
          if (departmentId) departmentOf(departmentId, meeting.companyId);
          meeting.departmentId = departmentId || null;
        }
        if (input.attendeeIds !== undefined) {
          const ids = new Set(asArray(input.attendeeIds));
          meeting.attendeeIds = state()
            .employees.filter(
              (employee) => employee.companyId === meeting.companyId && ids.has(employee.id),
            )
            .map((employee) => employee.id);
        }
        if (input.status !== undefined && MEETING_STATUSES.includes(input.status)) {
          meeting.status = input.status;
        }
        meeting.updatedAt = Date.now();
      },
      remove(input) {
        find(state().meetings, input.id, 'Toplantı');
        state().meetings = state().meetings.filter((item) => item.id !== input.id);
      },
    },

    notification: {
      markRead(input) {
        const targets = new Set(asArray(input.ids).map((id) => str(id, 160)).filter(Boolean));
        if (!targets.size) return;
        const read = new Map(state().notificationReads.map((item) => [item.id, item.readAt]));
        const at = Date.now();
        for (const id of targets) read.set(id, at);
        state().notificationReads = Array.from(read, ([id, readAt]) => ({ id, readAt }))
          .sort((a, b) => b.readAt - a.readAt)
          .slice(0, 500);
      },
    },

    client: {
      create(input) {
        const company = findCompany(input.companyId);
        const name = str(input.name, 160);
        if (!name) throw new Error('Müşteri adı gerekli.');
        const at = Date.now();
        state().clients.push({
          id: ID(),
          companyId: company.id,
          name,
          contactName: str(input.contactName, 120),
          email: str(input.email, 160),
          phone: str(input.phone, 60),
          status: pick(CLIENT_STATUSES, input.status, 'lead'),
          value: amountOf(input.value),
          nextFollowUp: dateOf(input.nextFollowUp),
          note: str(input.note, 1000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const client = find(state().clients, input.id, 'Müşteri');
        if (input.companyId !== undefined && input.companyId !== client.companyId) {
          client.companyId = findCompany(input.companyId).id;
        }
        if (input.name !== undefined) {
          const name = str(input.name, 160);
          if (!name) throw new Error('Müşteri adı gerekli.');
          client.name = name;
        }
        if (input.contactName !== undefined) client.contactName = str(input.contactName, 120);
        if (input.email !== undefined) client.email = str(input.email, 160);
        if (input.phone !== undefined) client.phone = str(input.phone, 60);
        if (input.status !== undefined && CLIENT_STATUSES.includes(input.status)) {
          client.status = input.status;
        }
        if (input.value !== undefined) client.value = amountOf(input.value);
        if (input.nextFollowUp !== undefined) client.nextFollowUp = dateOf(input.nextFollowUp);
        if (input.note !== undefined) client.note = str(input.note, 1000);
        client.updatedAt = Date.now();
      },
      remove(input) {
        find(state().clients, input.id, 'Müşteri');
        state().clients = state().clients.filter((item) => item.id !== input.id);
      },
    },

    contract: {
      create(input) {
        const company = findCompany(input.companyId);
        const title = str(input.title, 200);
        if (!title) throw new Error('Sözleşme başlığı gerekli.');
        const at = Date.now();
        state().contracts.push({
          id: ID(),
          companyId: company.id,
          title,
          counterparty: str(input.counterparty, 160),
          kind: pick(CONTRACT_KINDS, input.kind, 'service'),
          startDate: dateOf(input.startDate),
          endDate: dateOf(input.endDate),
          value: amountOf(input.value),
          status: pick(CONTRACT_STATUSES, input.status, 'active'),
          note: str(input.note, 2000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const contract = find(state().contracts, input.id, 'Sözleşme');
        if (input.companyId !== undefined && input.companyId !== contract.companyId) {
          contract.companyId = findCompany(input.companyId).id;
        }
        if (input.title !== undefined) {
          const title = str(input.title, 200);
          if (!title) throw new Error('Sözleşme başlığı gerekli.');
          contract.title = title;
        }
        if (input.counterparty !== undefined) contract.counterparty = str(input.counterparty, 160);
        if (input.kind !== undefined && CONTRACT_KINDS.includes(input.kind)) {
          contract.kind = input.kind;
        }
        if (input.startDate !== undefined) contract.startDate = dateOf(input.startDate);
        if (input.endDate !== undefined) contract.endDate = dateOf(input.endDate);
        if (input.value !== undefined) contract.value = amountOf(input.value);
        if (input.status !== undefined && CONTRACT_STATUSES.includes(input.status)) {
          contract.status = input.status;
        }
        if (input.note !== undefined) contract.note = str(input.note, 2000);
        contract.updatedAt = Date.now();
      },
      remove(input) {
        find(state().contracts, input.id, 'Sözleşme');
        state().contracts = state().contracts.filter((item) => item.id !== input.id);
      },
    },

    document: {
      create(input) {
        const company = findCompany(input.companyId);
        const title = str(input.title, 200);
        if (!title) throw new Error('Belge başlığı gerekli.');
        const at = Date.now();
        state().documents.push({
          id: str(input.id, 64) || ID(),
          companyId: company.id,
          title,
          category: pick(DOCUMENT_CATEGORIES, input.category, 'other'),
          fileName: str(input.fileName, 240),
          mimeType: str(input.mimeType, 120),
          size: Math.max(0, num(input.size, 0)),
          hasFile: Boolean(input.hasFile),
          note: str(input.note, 2000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const document = find(state().documents, input.id, 'Belge');
        if (input.companyId !== undefined && input.companyId !== document.companyId) {
          document.companyId = findCompany(input.companyId).id;
        }
        if (input.title !== undefined) {
          const title = str(input.title, 200);
          if (!title) throw new Error('Belge başlığı gerekli.');
          document.title = title;
        }
        if (input.category !== undefined && DOCUMENT_CATEGORIES.includes(input.category)) {
          document.category = input.category;
        }
        if (input.fileName !== undefined) document.fileName = str(input.fileName, 240);
        if (input.mimeType !== undefined) document.mimeType = str(input.mimeType, 120);
        if (input.size !== undefined) document.size = Math.max(0, num(input.size, 0));
        if (input.hasFile !== undefined) document.hasFile = Boolean(input.hasFile);
        if (input.note !== undefined) document.note = str(input.note, 2000);
        document.updatedAt = Date.now();
      },
      remove(input) {
        find(state().documents, input.id, 'Belge');
        state().documents = state().documents.filter((item) => item.id !== input.id);
      },
    },

    bug: {
      create(input) {
        const company = findCompany(input.companyId);
        const title = str(input.title, 200);
        if (!title) throw new Error('Hata başlığı gerekli.');
        const status = pick(BUG_STATUSES, input.status, 'open');
        const at = Date.now();
        state().bugs.push({
          id: ID(),
          companyId: company.id,
          projectId: str(input.projectId, 64) || null,
          title,
          description: str(input.description, 4000),
          severity: pick(BUG_SEVERITIES, input.severity, 'medium'),
          status,
          reportedBy: str(input.reportedBy, 120),
          assigneeId: str(input.assigneeId, 64) || null,
          createdAt: at,
          updatedAt: at,
          resolvedAt: status === 'resolved' || status === 'closed' ? at : null,
        });
      },
      update(input) {
        const bug = find(state().bugs, input.id, 'Hata kaydı');
        if (input.companyId !== undefined && input.companyId !== bug.companyId) {
          bug.companyId = findCompany(input.companyId).id;
        }
        if (input.projectId !== undefined) bug.projectId = str(input.projectId, 64) || null;
        if (input.title !== undefined) {
          const title = str(input.title, 200);
          if (!title) throw new Error('Hata başlığı gerekli.');
          bug.title = title;
        }
        if (input.description !== undefined) bug.description = str(input.description, 4000);
        if (input.severity !== undefined && BUG_SEVERITIES.includes(input.severity)) {
          bug.severity = input.severity;
        }
        if (input.status !== undefined && BUG_STATUSES.includes(input.status)) {
          bug.status = input.status;
          bug.resolvedAt =
            input.status === 'resolved' || input.status === 'closed'
              ? bug.resolvedAt ?? Date.now()
              : null;
        }
        if (input.reportedBy !== undefined) bug.reportedBy = str(input.reportedBy, 120);
        if (input.assigneeId !== undefined) bug.assigneeId = str(input.assigneeId, 64) || null;
        bug.updatedAt = Date.now();
      },
      remove(input) {
        find(state().bugs, input.id, 'Hata kaydı');
        state().bugs = state().bugs.filter((item) => item.id !== input.id);
      },
    },

    automation: {
      create(input) {
        const company = findCompany(input.companyId);
        const title = str(input.title, 200);
        if (!title) throw new Error('Kural başlığı gerekli.');
        const at = Date.now();
        state().automationRules.push({
          id: ID(),
          companyId: company.id,
          title,
          priority: pick(TASK_PRIORITIES, input.priority, 'med'),
          assigneeId: str(input.assigneeId, 64) || null,
          cadence: pick(AUTOMATION_CADENCES, input.cadence, 'weekly'),
          nextRun: dateOf(input.nextRun) || new Date().toISOString().slice(0, 10),
          enabled: input.enabled !== false,
          lastRun: null,
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const rule = find(state().automationRules, input.id, 'Kural');
        if (input.companyId !== undefined && input.companyId !== rule.companyId) {
          rule.companyId = findCompany(input.companyId).id;
        }
        if (input.title !== undefined) {
          const title = str(input.title, 200);
          if (!title) throw new Error('Kural başlığı gerekli.');
          rule.title = title;
        }
        if (input.priority !== undefined && TASK_PRIORITIES.includes(input.priority)) {
          rule.priority = input.priority;
        }
        if (input.assigneeId !== undefined) rule.assigneeId = str(input.assigneeId, 64) || null;
        if (input.cadence !== undefined && AUTOMATION_CADENCES.includes(input.cadence)) {
          rule.cadence = input.cadence;
        }
        if (input.nextRun !== undefined && dateOf(input.nextRun)) rule.nextRun = dateOf(input.nextRun);
        if (input.enabled !== undefined) rule.enabled = Boolean(input.enabled);
        rule.updatedAt = Date.now();
      },
      remove(input) {
        find(state().automationRules, input.id, 'Kural');
        state().automationRules = state().automationRules.filter((item) => item.id !== input.id);
      },
      run(input) {
        const rule = find(state().automationRules, input.id, 'Kural');
        if (!rule.enabled) throw new Error('Kural pasif durumda.');
        const at = Date.now();
        const assignee = rule.assigneeId
          ? state().employees.find(
              (employee) =>
                employee.id === rule.assigneeId && employee.companyId === rule.companyId,
            )
          : null;
        state().tasks.push({
          id: ID(),
          title: rule.title,
          companyId: rule.companyId,
          priority: rule.priority,
          due: rule.nextRun,
          done: false,
          assigneeId: assignee ? assignee.id : null,
          createdAt: at,
          completedAt: null,
        });
        rule.lastRun = at;
        const next = new Date(`${rule.nextRun}T12:00:00`);
        if (rule.cadence === 'daily') next.setDate(next.getDate() + 1);
        else if (rule.cadence === 'monthly') next.setMonth(next.getMonth() + 1);
        else next.setDate(next.getDate() + 7);
        rule.nextRun = next.toISOString().slice(0, 10);
        rule.updatedAt = at;
      },
    },

    security: {
      log(input) {
        const detail = str(input.detail, 600);
        if (!detail) throw new Error('Kayıt ayrıntısı gerekli.');
        state().securityEvents.unshift({
          id: ID(),
          at: Date.now(),
          kind: pick(SECURITY_KINDS, input.kind, 'account'),
          actor: str(input.actor, 120) || 'Yerel yönetici',
          detail,
          companyId: str(input.companyId, 64) || null,
        });
        state().securityEvents = state().securityEvents.slice(0, 500);
      },
      clear() {
        state().securityEvents = [];
      },
    },

    employee: {
      create(input) {
        const company = findCompany(input.companyId);
        const name = str(input.name, 160);
        if (!name) throw new Error('Çalışan adı gerekli.');
        const departmentId = str(input.departmentId, 64);
        if (departmentId) departmentOf(departmentId, company.id);
        const roleId = str(input.roleId, 64);
        if (
          roleId &&
          !state().roles.some((role) => role.id === roleId && role.companyId === company.id)
        ) {
          throw new Error('Yetki rolü bulunamadı.');
        }
        const at = Date.now();
        state().employees.push({
          id: ID(),
          companyId: company.id,
          name,
          role: str(input.role, 120),
          email: str(input.email, 160),
          status: pick(EMPLOYEE_STATUSES, input.status, 'active'),
          startDate: dateOf(input.startDate),
          departmentId: departmentId || null,
          roleId: roleId || null,
          notes: str(input.notes, 2000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const employee = find(state().employees, input.id, 'Çalışan');
        if (input.companyId !== undefined && input.companyId !== employee.companyId) {
          employee.companyId = findCompany(input.companyId).id;
          if (input.departmentId === undefined) employee.departmentId = null;
          if (input.roleId === undefined) employee.roleId = null;
        }
        if (input.name !== undefined) {
          const name = str(input.name, 160);
          if (!name) throw new Error('Çalışan adı gerekli.');
          employee.name = name;
        }
        if (input.role !== undefined) employee.role = str(input.role, 120);
        if (input.email !== undefined) employee.email = str(input.email, 160);
        if (input.status !== undefined && EMPLOYEE_STATUSES.includes(input.status)) {
          employee.status = input.status;
        }
        if (input.startDate !== undefined) employee.startDate = dateOf(input.startDate);
        if (input.departmentId !== undefined) {
          const departmentId = str(input.departmentId, 64);
          if (departmentId) departmentOf(departmentId, employee.companyId);
          employee.departmentId = departmentId || null;
        }
        if (input.roleId !== undefined) {
          const roleId = str(input.roleId, 64);
          if (
            roleId &&
            !state().roles.some(
              (role) => role.id === roleId && role.companyId === employee.companyId,
            )
          ) {
            throw new Error('Yetki rolü bulunamadı.');
          }
          employee.roleId = roleId || null;
        }
        if (input.notes !== undefined) employee.notes = str(input.notes, 2000);
        employee.updatedAt = Date.now();
      },
      remove(input) {
        const employee = find(state().employees, input.id, 'Çalışan');
        state().employees = state().employees.filter((item) => item.id !== employee.id);
        state().performanceReviews = state().performanceReviews.filter(
          (review) => review.employeeId !== employee.id,
        );
        const directIds = new Set(
          state()
            .chatThreads.filter((thread) => thread.employeeId === employee.id)
            .map((thread) => thread.id),
        );
        if (directIds.size) {
          state().chatThreads = state().chatThreads.filter((thread) => !directIds.has(thread.id));
          state().chatMessages = state().chatMessages.filter(
            (message) => !directIds.has(message.threadId),
          );
        }
        state().meetings = state().meetings.map((meeting) =>
          meeting.attendeeIds.includes(employee.id)
            ? {
                ...meeting,
                attendeeIds: meeting.attendeeIds.filter((id) => id !== employee.id),
                updatedAt: Date.now(),
              }
            : meeting,
        );
        state().salaries = state().salaries.map((salary) =>
          salary.employeeId === employee.id
            ? {
                ...salary,
                employeeId: null,
                employeeName: salary.employeeName || employee.name,
                updatedAt: Date.now(),
              }
            : salary,
        );
        state().tasks = state().tasks.map((task) =>
          task.assigneeId === employee.id ? { ...task, assigneeId: null } : task,
        );
        state().bugs = state().bugs.map((bug) =>
          bug.assigneeId === employee.id
            ? { ...bug, assigneeId: null, updatedAt: Date.now() }
            : bug,
        );
        state().automationRules = state().automationRules.map((rule) =>
          rule.assigneeId === employee.id
            ? { ...rule, assigneeId: null, updatedAt: Date.now() }
            : rule,
        );
      },
    },

    department: {
      create(input) {
        const company = findCompany(input.companyId);
        const name = str(input.name, 120);
        if (!name) throw new Error('Departman adı gerekli.');
        const at = Date.now();
        const color = str(input.color, 7);
        state().departments.push({
          id: ID(),
          companyId: company.id,
          name,
          description: str(input.description, 1000),
          color: /^#[0-9a-f]{6}$/i.test(color)
            ? color
            : DEPARTMENT_COLORS[state().departments.length % DEPARTMENT_COLORS.length],
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const department = find(state().departments, input.id, 'Departman');
        if (input.companyId !== undefined && input.companyId !== department.companyId) {
          department.companyId = findCompany(input.companyId).id;
          for (const employee of state().employees) {
            if (employee.departmentId === department.id) employee.departmentId = null;
          }
        }
        if (input.name !== undefined) {
          const name = str(input.name, 120);
          if (!name) throw new Error('Departman adı gerekli.');
          department.name = name;
        }
        if (input.description !== undefined) department.description = str(input.description, 1000);
        if (input.color !== undefined && /^#[0-9a-f]{6}$/i.test(str(input.color, 7))) {
          department.color = str(input.color, 7);
        }
        department.updatedAt = Date.now();
      },
      remove(input) {
        find(state().departments, input.id, 'Departman');
        state().departments = state().departments.filter((item) => item.id !== input.id);
        for (const employee of state().employees) {
          if (employee.departmentId === input.id) employee.departmentId = null;
        }
        const threadIds = new Set(
          state()
            .chatThreads.filter((thread) => thread.departmentId === input.id)
            .map((thread) => thread.id),
        );
        if (threadIds.size) {
          state().chatThreads = state().chatThreads.filter((thread) => !threadIds.has(thread.id));
          state().chatMessages = state().chatMessages.filter(
            (message) => !threadIds.has(message.threadId),
          );
        }
        state().announcements = state().announcements.map((announcement) =>
          announcement.departmentId === input.id
            ? { ...announcement, departmentId: null, updatedAt: Date.now() }
            : announcement,
        );
        state().meetings = state().meetings.map((meeting) =>
          meeting.departmentId === input.id
            ? { ...meeting, departmentId: null, updatedAt: Date.now() }
            : meeting,
        );
      },
    },

    role: {
      create(input) {
        const company = findCompany(input.companyId);
        const name = str(input.name, 120);
        if (!name) throw new Error('Rol adı gerekli.');
        const permissions = Array.from(
          new Set(asArray(input.permissions).filter((item) => PERMISSION_KEYS.includes(item))),
        );
        const at = Date.now();
        state().roles.push({
          id: ID(),
          companyId: company.id,
          name,
          description: str(input.description, 1000),
          permissions,
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const role = find(state().roles, input.id, 'Rol');
        if (input.companyId !== undefined && input.companyId !== role.companyId) {
          role.companyId = findCompany(input.companyId).id;
          for (const employee of state().employees) {
            if (employee.roleId === role.id) employee.roleId = null;
          }
        }
        if (input.name !== undefined) {
          const name = str(input.name, 120);
          if (!name) throw new Error('Rol adı gerekli.');
          role.name = name;
        }
        if (input.description !== undefined) role.description = str(input.description, 1000);
        if (input.permissions !== undefined) {
          role.permissions = Array.from(
            new Set(asArray(input.permissions).filter((item) => PERMISSION_KEYS.includes(item))),
          );
        }
        role.updatedAt = Date.now();
      },
      remove(input) {
        find(state().roles, input.id, 'Rol');
        state().roles = state().roles.filter((item) => item.id !== input.id);
        for (const employee of state().employees) {
          if (employee.roleId === input.id) employee.roleId = null;
        }
      },
    },

    performanceReview: {
      create(input) {
        const employee = employeeOf(input.employeeId, state().employees.find((item) => item.id === input.employeeId)?.companyId);
        const period = periodOf(input.period);
        if (!period) throw new Error('Dönem gerekli.');
        const score = Math.round(num(input.score, -1));
        if (score < 0 || score > 100) throw new Error('Puan 0 ile 100 arasında olmalı.');
        const at = Date.now();
        state().performanceReviews.push({
          id: ID(),
          employeeId: employee.id,
          companyId: employee.companyId,
          period,
          score,
          reviewer: str(input.reviewer, 120),
          strengths: str(input.strengths, 2000),
          improvements: str(input.improvements, 2000),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const review = find(state().performanceReviews, input.id, 'Değerlendirme');
        if (input.period !== undefined) {
          const period = periodOf(input.period);
          if (!period) throw new Error('Dönem gerekli.');
          review.period = period;
        }
        if (input.score !== undefined) {
          const score = Math.round(num(input.score, -1));
          if (score < 0 || score > 100) throw new Error('Puan 0 ile 100 arasında olmalı.');
          review.score = score;
        }
        if (input.reviewer !== undefined) review.reviewer = str(input.reviewer, 120);
        if (input.strengths !== undefined) review.strengths = str(input.strengths, 2000);
        if (input.improvements !== undefined) review.improvements = str(input.improvements, 2000);
        review.updatedAt = Date.now();
      },
      remove(input) {
        find(state().performanceReviews, input.id, 'Değerlendirme');
        state().performanceReviews = state().performanceReviews.filter(
          (review) => review.id !== input.id,
        );
      },
    },

    project: {
      create(input) {
        const company = findCompany(input.companyId);
        const name = str(input.name, 160);
        if (!name) throw new Error('Proje adı gerekli.');
        const at = Date.now();
        state().projects.push({
          id: ID(),
          companyId: company.id,
          name,
          description: str(input.description, 2000),
          status: pick(PROJECT_STATUSES, input.status, 'active'),
          progress: Math.min(100, Math.max(0, num(input.progress, 0))),
          dueDate: dateOf(input.dueDate),
          createdAt: at,
          updatedAt: at,
        });
      },
      update(input) {
        const project = find(state().projects, input.id, 'Proje');
        if (input.companyId !== undefined) project.companyId = findCompany(input.companyId).id;
        if (input.name !== undefined) {
          const name = str(input.name, 160);
          if (!name) throw new Error('Proje adı gerekli.');
          project.name = name;
        }
        if (input.description !== undefined) project.description = str(input.description, 2000);
        if (input.status !== undefined && PROJECT_STATUSES.includes(input.status)) {
          project.status = input.status;
        }
        if (input.progress !== undefined) {
          project.progress = Math.min(100, Math.max(0, num(input.progress, 0)));
        }
        if (input.dueDate !== undefined) project.dueDate = dateOf(input.dueDate);
        project.updatedAt = Date.now();
      },
      remove(input) {
        find(state().projects, input.id, 'Proje');
        state().projects = state().projects.filter((item) => item.id !== input.id);
      },
    },

    approval: {
      create(input) {
        const company = findCompany(input.companyId);
        const title = str(input.title, 200);
        if (!title) throw new Error('Onay başlığı gerekli.');
        const amount = num(input.amount, 0);
        state().approvals.push({
          id: ID(),
          companyId: company.id,
          title,
          requestedBy: str(input.requestedBy, 120),
          amount: amount > 0 ? amount : null,
          note: str(input.note, 1000),
          status: 'pending',
          decidedBy: '',
          decisionNote: '',
          createdAt: Date.now(),
          decidedAt: null,
        });
      },
      update(input) {
        const approval = find(state().approvals, input.id, 'Onay');
        if (input.companyId !== undefined) approval.companyId = findCompany(input.companyId).id;
        if (input.title !== undefined) {
          const title = str(input.title, 200);
          if (!title) throw new Error('Onay başlığı gerekli.');
          approval.title = title;
        }
        if (input.requestedBy !== undefined) approval.requestedBy = str(input.requestedBy, 120);
        if (input.amount !== undefined) {
          const amount = num(input.amount, 0);
          approval.amount = amount > 0 ? amount : null;
        }
        if (input.note !== undefined) approval.note = str(input.note, 1000);
        if (input.status !== undefined && ['approved', 'rejected'].includes(input.status)) {
          approval.status = input.status;
          approval.decidedAt = approval.decidedAt ?? Date.now();
        }
        if (input.decidedBy !== undefined) approval.decidedBy = str(input.decidedBy, 120);
        if (input.decisionNote !== undefined) approval.decisionNote = str(input.decisionNote, 1000);
      },
      remove(input) {
        find(state().approvals, input.id, 'Onay');
        state().approvals = state().approvals.filter((item) => item.id !== input.id);
      },
      decide(input) {
        const approval = find(state().approvals, input.id, 'Onay');
        if (!['approved', 'rejected'].includes(input.status)) {
          throw new Error('Geçersiz onay durumu.');
        }
        approval.status = input.status;
        approval.decidedAt = Date.now();
        const decision = input.decision || {};
        if (decision.decidedBy !== undefined) approval.decidedBy = str(decision.decidedBy, 120);
        if (decision.decisionNote !== undefined) {
          approval.decisionNote = str(decision.decisionNote, 1000);
        }
      },
    },
  };

  handle('data:local', (payload) => {
    const entity = str(payload.entity, 40);
    const op = str(payload.op, 40);
    const group = handlers[entity];
    if (!group) throw new Error('Bilinmeyen veri türü.');
    const run = group[op];
    if (typeof run !== 'function') throw new Error('Bilinmeyen işlem.');
    run(payload.input && typeof payload.input === 'object' ? payload.input : {});
    store.save();
    return current();
  });

  return { handlers };
}

module.exports = { registerLocalData };
