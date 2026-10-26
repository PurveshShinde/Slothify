/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AUDIO_SERVICE_URL?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
