import {
  FreeePrivateApi,
  FreeePublicApi,
} from "@freee-line-notifier/external-api/freee";
import { getPrisma } from "@freee-line-notifier/prisma";
import { HTTPException } from "hono/http-exception";
import { createRoute } from "honox/factory";

export const GET = createRoute(async (c) => {
  const { FREEE_API_CLIENT_ID, FREEE_API_CLIENT_SECRET, DB } = c.env;

  const prisma = getPrisma(DB);
  const company = await prisma.company.findFirstOrThrow();

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
    where: { id: company.id },
    data: {
      refreshToken: accessToken.refresh_token,
    },
  });

  const payload = {
    issue_date: "2025-01-16",
    type: "expense",
    company_id: 10092363,
    details: [
      {
        tax_code: 2,
        account_item_id: 626477460, // 事業主貸
        amount: 5000,
        description: "備考",
      },
    ],
    payments: [
      {
        amount: 5000,
        from_walletable_id: 2896000,
        from_walletable_type: "bank_account",
        date: "2025-01-16",
      },
    ],
  };

  const privateApi = new FreeePrivateApi({
    accessToken: accessToken.access_token,
  });

  const result = await privateApi.createDeal(payload);

  return c.json({ result });
});
