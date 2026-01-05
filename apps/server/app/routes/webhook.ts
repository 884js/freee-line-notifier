import { getPrisma } from "@freee-line-notifier/prisma";
import {
  SignatureValidationFailed,
  messagingApi,
  middleware,
  validateSignature,
} from "@line/bot-sdk";
import type {
  MessageEvent,
  TemplateMessage,
  WebhookEvent,
} from "@line/bot-sdk";
import type { Context, Env } from "hono";
import { createRoute } from "honox/factory";
import { dailyReportModule } from "../functions/dailyReportModule";

type LineClientParams = {
  accessToken: string;
  secret: string;
};

export const POST = createRoute(async (c) => {
  const events: WebhookEvent[] = await c.req.json().then((data) => data.events);

  const signature = c.req.header("x-line-signature");
  const body = await c.req.text();

  if (
    !signature ||
    !validateSignature(body, c.env.LINE_CHANNEL_SECRET, signature)
  ) {
    throw new SignatureValidationFailed("signature validation failed", {
      signature,
    });
  }

  await Promise.all(
    events.map(async (event) => {
      try {
        c.executionCtx.waitUntil(
          handleMessageEvent({
            event,
            env: c.env,
            context: c,
          }),
        );
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.error("err", err);
        }
        return c.json({ message: "error" });
      }
    }),
  );

  return c.json({ message: "success" });
});

const handleMessageEvent = async ({
  event,
  env,
  context,
}: BaseContext & { event: WebhookEvent }) => {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }
  const message = event.message.text;

  const messageContext: MessageHandlerContext = {
    event,
    env,
    context,
  };

  switch (message) {
    case "アカウント設定":
      await handleAccountSettings(messageContext);
      break;
    case "メニュー":
      await handleMenu(messageContext);
      break;
    case "デイリーレポート":
    case "テスト":
      await handleDailyReport(messageContext);
      break;
    case "アカウント連携解除":
      await handleUnlinkAccount(messageContext);
      break;
  }
};

const initializeLineClient = ({ accessToken, secret }: LineClientParams) => {
  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: accessToken,
  });
  middleware({ channelSecret: secret });
  return client;
};

type BaseContext = {
  context: Context;
  env: Env["Bindings"];
};

type MessageHandlerContext = BaseContext & {
  event: MessageEvent;
};

const handleAccountSettings = async ({ event, env }: MessageHandlerContext) => {
  const lineUserId = event.source.userId;
  const client = initializeLineClient({
    accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    secret: env.LINE_CHANNEL_SECRET,
  });

  const prisma = getPrisma(env.DB);

  const user = await prisma.user.findUnique({
    where: {
      lineUserId: lineUserId,
    },
  });

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "template",
        altText: "Account Link",
        template: {
          type: "buttons",
          text: "設定メニュー",
          actions: [
            user
              ? {
                  type: "message",
                  label: "アカウント連携解除",
                  text: "アカウント連携解除",
                }
              : {
                  type: "uri",
                  label: "アカウント連携開始",
                  uri: env.LINE_LIFF_AUTH_URL,
                },
          ],
        },
      },
    ],
  });
};

const handleMenu = async ({ event, env }: MessageHandlerContext) => {
  const lineUserId = event.source.userId;

  const client = initializeLineClient({
    accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    secret: env.LINE_CHANNEL_SECRET,
  });

  if (!lineUserId) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [notLinkedMessage(env.LINE_LIFF_AUTH_URL)],
    });
    return;
  }

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "template",
        altText: "メニュー",
        template: {
          type: "buttons",
          text: "メニュー",
          actions: [
            {
              type: "message",
              label: "デイリーレポート取得",
              text: "デイリーレポート",
            },
          ],
        },
      },
    ],
  });
};

const handleDailyReport = async ({ event, env }: MessageHandlerContext) => {
  const lineUserId = event.source.userId;

  if (!lineUserId) {
    console.error("lineUserId not found");
    return;
  }

  try {
    const client = initializeLineClient({
      accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
      secret: env.LINE_CHANNEL_SECRET,
    });

    console.log("Generating daily report for user:", lineUserId);
    const result = await dailyReportModule.generate({
      env,
      lineUserId,
    });
    console.log("Daily report generated:", { companyId: result.companyId });

    await client.pushMessage({
      to: lineUserId,
      messages: [dailyReportModule.message(result)],
    });
    console.log("Daily report sent successfully");
  } catch (error) {
    console.error("Error in handleDailyReport:", error);
    throw error;
  }
};

const handleUnlinkAccount = async ({ event, env }: MessageHandlerContext) => {
  const lineUserId = event.source.userId;

  const client = initializeLineClient({
    accessToken: env.LINE_CHANNEL_ACCESS_TOKEN,
    secret: env.LINE_CHANNEL_SECRET,
  });

  if (!lineUserId) {
    await client.replyMessage({
      replyToken: event.replyToken,
      messages: [notLinkedMessage(env.LINE_LIFF_AUTH_URL)],
    });
    return;
  }

  const prisma = getPrisma(env.DB);

  await prisma.user.delete({
    where: {
      lineUserId,
    },
  });

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [{ type: "text", text: "アカウント連携を解除しました" }],
  });
};

const notLinkedMessage = (LIFF_URL: string) => {
  return {
    type: "template",
    altText: "アカウント連携されていません",
    template: {
      type: "buttons",
      text: "アカウントが連携されていません。「アカウント連携する」を押して連携してください。",
      actions: [
        {
          type: "uri",
          label: "アカウント連携する",
          uri: LIFF_URL,
        },
      ],
    },
  } satisfies TemplateMessage;
};
