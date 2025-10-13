/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module "@tauri-apps/plugin-notification" {
  export function sendNotification(options: {
    title: string;
    body: string;
  }): Promise<void>;
}
