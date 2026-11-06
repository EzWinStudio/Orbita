import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ezwin.orbita',
  appName: 'Orbita',
  webDir: process.env.ORBITA_ANDROID_WEB ?? 'web-dist',
  backgroundColor: '#050807',
  server: {
    androidScheme: 'https',
    hostname: 'localhost',
  },
  android: {
    backgroundColor: '#050807',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      launchAutoHide: true,
      backgroundColor: '#050807',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#050807',
    },
  },
};

export default config;
