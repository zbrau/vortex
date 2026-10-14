import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vortex.app',
  appName: 'Vortex',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
