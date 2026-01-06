import { FreeePublicApi } from "@freee-line-notifier/external-api/freee";
import { getPrisma } from "@freee-line-notifier/prisma";
import type { Env } from "hono";

export async function refreshAccessToken({
  env,
  refreshToken,
}: {
  env: Env["Bindings"];
  refreshToken: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const freePublicApi = new FreeePublicApi({
    clientId: env.FREEE_API_CLIENT_ID,
    clientSecret: env.FREEE_API_CLIENT_SECRET,
  });

  const prisma = getPrisma(env.DB);

  const accessToken = await freePublicApi.refreshAccessToken({
    refreshToken,
  });

  await prisma.company.update({
    where: {
      refreshToken,
    },
    data: {
      refreshToken: accessToken.refresh_token,
    },
  });

  return {
    accessToken: accessToken.access_token,
    refreshToken: accessToken.refresh_token,
  };
}
