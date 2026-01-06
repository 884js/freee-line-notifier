import { FreeePublicApi } from "@freee-line-notifier/external-api/freee";
import { LineApi } from "@freee-line-notifier/external-api/line";
import { getPrisma } from "@freee-line-notifier/prisma";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

const app = new Hono();

export const registrationRoute = app.post(
  "/",
  zValidator(
    "form",
    z.object({
      code: z.string(),
    }),
  ),
  async (c) => {
    const {
      LINE_LIFF_AUTH_URL,
      FREEE_API_CLIENT_ID,
      FREEE_API_CLIENT_SECRET,
      DB,
    } = c.env;
    const authorization = c.req.header("Authorization");

    if (!authorization) {
      throw new HTTPException(401, { message: "invalid authorization header" });
    }

    const prisma = getPrisma(DB);

    const { code } = c.req.valid("form");
    const lineApi = new LineApi({ accessToken: authorization });
    const freeeApi = new FreeePublicApi({
      clientId: FREEE_API_CLIENT_ID,
      clientSecret: FREEE_API_CLIENT_SECRET,
    });

    const { company_id, refresh_token } = await freeeApi.getAccessToken({
      code,
      grantType: "authorization_code",
      redirectUri: LINE_LIFF_AUTH_URL,
    });

    const { userId: lineUserId, displayName } = await lineApi.getProfile();

    const company = await prisma.company.upsert({
      where: {
        companyId: company_id,
      },
      create: {
        companyId: company_id,
        refreshToken: refresh_token,
      },
      update: {
        refreshToken: refresh_token,
      },
    });

    await prisma.user.upsert({
      where: {
        lineUserId: lineUserId,
      },
      update: {
        name: displayName,
        activeCompanyId: company.id,
      },
      create: {
        lineUserId: lineUserId,
        name: displayName,
        activeCompanyId: company.id,
      },
    });

    return c.json({ message: "success" });
  },
);
