/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    data: {
      queryClient?: import("@tanstack/react-query").QueryClient;
    };
    dispose(cb: (data: { queryClient?: import("@tanstack/react-query").QueryClient }) => void): void;
  };
}

declare module "*.css" {}
declare module "*.svg" {
  const src: string;
  export default src;
}
