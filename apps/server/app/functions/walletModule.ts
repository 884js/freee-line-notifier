import { FreeePrivateApi } from "@freee-line-notifier/external-api/freee";
import { getPrisma } from "@freee-line-notifier/prisma";
import type { FlexBubble } from "@line/bot-sdk";
import type { Env } from "hono";
import { generateFailedWalletsMessage } from "../lib/MessagingApi/generateFailedWalletsMessage";
import { refreshAccessToken } from "./refreshAccessToken";

export type GetSyncFailedWalletsType = Awaited<
  ReturnType<typeof getSyncFailedWallets>
>;

const getSyncFailedWallets = async ({
  env,
  lineUserId,
}: { env: Env["Bindings"]; lineUserId: string }) => {
  const { DB } = env;
  const prisma = getPrisma(DB);

  const user = await prisma.user.findFirstOrThrow({
    where: {
      lineUserId,
    },
    include: {
      activeCompany: true,
    },
  });

  const company = user.activeCompany;

  const result = await refreshAccessToken({
    env,
    refreshToken: company.refreshToken,
  });

  const privateApi = new FreeePrivateApi({
    accessToken: result.accessToken,
  });

  const walletables = await privateApi.getWalletables({
    companyId: company.companyId,
  });

  const filteredWalletables = walletables.filter(
    (walletable) =>
      walletable.sync_status === "other_error" ||
      walletable.sync_status === "token_refresh_error",
  );

  return filteredWalletables;
};

const getFailedWalletsMessage = (walletables: GetSyncFailedWalletsType) => {
  const count = walletables.length;

  return {
    type: "flex" as const,
    altText: `同期エラー通知(${count}件)`,
    contents: {
      type: "bubble",
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        contents: [
          {
            type: "text" as const,
            text: `同期エラー通知(${count}件)`,
            weight: "bold" as const,
            size: "lg" as const,
          },
          {
            type: "separator" as const,
            margin: "sm" as const,
          },
          {
            type: "text" as const,
            text: "口座情報",
            margin: "sm" as const,
            decoration: "underline" as const,
            weight: "bold" as const,
          },
          {
            type: "box",
            layout: "vertical",
            contents: generateFailedWalletsMessage(walletables),
          },
        ],
      },
    } satisfies FlexBubble,
  };
};

export const walletModule = {
  failedWallets: getSyncFailedWallets,
  failedWalletMessage: getFailedWalletsMessage,
};
