/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The git commit of a production build (see vite.config.ts) */
  readonly BUILD_ID?: string;
}
