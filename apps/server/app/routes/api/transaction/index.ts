import {
  FreeePrivateApi,
  FreeePublicApi,
} from "@freee-line-notifier/external-api/freee";
import { getPrisma } from "@freee-line-notifier/prisma";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

const app = new Hono();

export const transactionRoute = app.get(
  "/:id",
  zValidator(
    "query",
    z.object({
      companyId: z.string().transform(Number),
    }),
  ),
  zValidator(
    "param",
    z.object({
      id: z.string(),
    }),
  ),
  async (c) => {
    const { FREEE_API_CLIENT_ID, FREEE_API_CLIENT_SECRET, DB } =
      c.env;

    const { id } = c.req.valid("param");
    const currentUser = c.get("currentUser");

    const { companyId } = c.req.valid("query");

    try {
      const prisma = getPrisma(DB);
      const company = currentUser?.companies.find(
        (compamy) => compamy.companyId === companyId,
      );

      if (!company) {
        throw new HTTPException(401, {
          message: "事業所が見つかりませんでした",
        });
      }

      const publicApi = new FreeePublicApi({
        clientId: FREEE_API_CLIENT_ID,
        clientSecret: FREEE_API_CLIENT_SECRET,
      });

      const accessToken = await publicApi.refreshAccessToken({
        refreshToken: company.refreshToken,
      });

      await prisma.company.update({
        where: {
          id: company.id,
        },
        data: {
          refreshToken: accessToken.refresh_token,
        },
      });

      const privateApi = new FreeePrivateApi({
        accessToken: accessToken.access_token,
      });

      const result = await privateApi.getWalletTxn({
        id: Number(id),
        companyId: company.companyId,
      });

      return c.json({ result });
    } catch {
      return c.json({ result: "エラー" }, 500);
    }
  },
);
