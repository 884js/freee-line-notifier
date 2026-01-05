/// <reference types="vite/client" />

import {} from "hono";

type Head = {
  title?: string;
};

declare module "hono" {
  interface Env {
    Bindings: {
      DB: D1Database;
      DATABASE_URL: string;
      FREEE_PUBLIC_API_URL: string;
      FREEE_API_URL: string;
      FREEE_API_CLIENT_ID: string;
      FREEE_API_CLIENT_SECRET: string;
      LINE_CHANNEL_ACCESS_TOKEN: string;
      LINE_CHANNEL_SECRET: string;
    };
  }
  type ContextRenderer = (
    content: string | Promise<string>,
    head?: Head,
  ) => Response | Promise<Response>;
}
