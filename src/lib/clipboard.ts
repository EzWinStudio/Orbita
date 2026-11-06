type HostClipboard = {
  copyText?: (text: string) => boolean | Promise<boolean>;
};

type LegacyClipboard = {
  app?: { copyText?: (text: string) => void };
};

function fallbackCopy(value: string): boolean {
  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '0';
    area.style.left = '0';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, value.length);
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  const value = String(text ?? '');
  if (!value) return false;

  const host = (window as Window & { ezwinHost?: HostClipboard }).ezwinHost;
  if (host && typeof host.copyText === 'function') {
    try {
      const result = await host.copyText(value);
      if (result !== false) return true;
    } catch {
      /* Electron panosu kullanılamadı; tarayıcı yolunu dene */
    }
  }

  const legacy = (window as Window & { ezwin?: LegacyClipboard }).ezwin;
  if (legacy?.app?.copyText) {
    try {
      legacy.app.copyText(value);
      return true;
    } catch {
      /* eski köprü yok sayılır */
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* izin reddedildi; son çare seçim tabanlı kopyalama */
    }
  }

  return fallbackCopy(value);
}
