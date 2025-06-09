import { getPrisma } from "@freee-line-notifier/prisma";
import { dailyReportModule, walletModule } from "@freee-line-notifier/server";
import * as line from "@line/bot-sdk";
import type { Env } from "hono";

const SCHEDULE_TYPE = {
  DAILY_REPORT: "DAILY_REPORT",
  SYNC_FAILED_WALLETS: "SYNC_FAILED_WALLETS",
} as const;

type ScheduleType = (typeof SCHEDULE_TYPE)[keyof typeof SCHEDULE_TYPE];

// MEMO: http://localhost:8787/__scheduled?cron=30+23+*+*+*にアクセスするとテスト実行される
export default {
  async fetch(
    request: Request,
    env: Env["Bindings"],
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    
    // スケジュールテスト用エンドポイント
    if (url.pathname === "/__scheduled") {
      const cron = url.searchParams.get("cron") || "0 0 * * *";
      
      const controller = {
        cron,
        scheduledTime: Date.now(),
      } as ScheduledController;
      
      ctx.waitUntil(this.scheduled(controller, env, ctx));
      
      return new Response("Scheduled task triggered", { status: 200 });
    }
    
    return new Response("Worker is running", { status: 200 });
  },

  async scheduled(
    controller: ScheduledController,
    env: Env["Bindings"],
    ctx: ExecutionContext,
  ) {
    switch (controller.cron) {
      // 毎朝10時に実行される(UTC+9)
      case "0 0 * * *":
        ctx.waitUntil(
          handleSchedule({ env, type: SCHEDULE_TYPE.DAILY_REPORT }),
        );
        break;
      //　毎朝8時半に実行される(UTC+9)
      case "30 23 * * *":
        ctx.waitUntil(
          handleSchedule({ env, type: SCHEDULE_TYPE.SYNC_FAILED_WALLETS }),
        );
        break;
    }
  },
};

async function handleSchedule({
  env,
  type,
}: { env: Env["Bindings"]; type: ScheduleType }) {
  const { LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, DATABASE_URL } = env;

  const config: line.ClientConfig = {
    channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
  };

  const client = new line.messagingApi.MessagingApiClient(config);

  line.middleware({ channelSecret: LINE_CHANNEL_SECRET });

  const prisma = getPrisma(DATABASE_URL);
  const userList = await prisma.user.findMany();

  switch (type) {
    case SCHEDULE_TYPE.DAILY_REPORT:
      {
        await Promise.all(
          userList.map(async (user) => {
            const result = await dailyReportModule.generate({
              env,
              lineUserId: user.lineUserId,
            });
            console.log("SCHEDULE_TYPE.DAILY_REPORT result", result);

            await client.pushMessage({
              to: user.lineUserId,
              messages: [dailyReportModule.message(result)],
            });
          }),
        );
      }
      break;
    case SCHEDULE_TYPE.SYNC_FAILED_WALLETS:
      {
        await Promise.all(
          userList.map(async (user) => {
            const result = await walletModule.failedWallets({
              env,
              lineUserId: user.lineUserId,
            });
            console.log("SCHEDULE_TYPE.SYNC_FAILED_WALLETS result", result);

            // MEMO: 失敗してる口座がない場合は実行しない
            if (result.length === 0) {
              return;
            }

            await client.pushMessage({
              to: user.lineUserId,
              messages: [walletModule.failedWalletMessage(result)],
            });
          }),
        );
      }
      break;
  }
}
