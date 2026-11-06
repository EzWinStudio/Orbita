type CapacitorBridge = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

const bridge = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;

export const IS_ANDROID_APP =
  Boolean(bridge?.isNativePlatform?.()) && bridge?.getPlatform?.() === 'android';

export const NATIVE_API_BASE = IS_ANDROID_APP ? 'https://orbita.wasmer.app' : '';

if (IS_ANDROID_APP) {
  document.documentElement.classList.add('capacitor-android');
}
