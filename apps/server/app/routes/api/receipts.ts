import type { GetWalletTxtListResponse } from "@freee-line-notifier/external-api/freee";
import { FreeePrivateApi } from "@freee-line-notifier/external-api/freee";
import { getPrisma } from "@freee-line-notifier/prisma";
import { Hono } from "hono";
import type { Env } from "hono";
import { refreshAccessToken } from "../../functions/refreshAccessToken";

const app = new Hono<Env>();

// 領収書が必要な勘定科目
const RECEIPT_REQUIRED_ITEMS = [
  { name: "通信費", id: 626477503 },
  { name: "交際費", id: 626477505 },
  { name: "消耗品費", id: 626477508 },
  { name: "事務用品費", id: 626477509 },
  { name: "会議費", id: 626477529 },
  { name: "新聞図書費", id: 626477530 },
  { name: "雑費", id: 626477534 },
  { name: "工具器具備品", id: 626477442 },
  { name: "ソフトウェア", id: 626477543 },
  { name: "旅費交通費", id: 626477502 },
  { name: "租税公課", id: 626477498 },
];

type Payment = {
  id: number;
  date: string;
  from_walletable_type: string;
  from_walletable_id: number;
  amount: number;
};

// wallet_txnsとのマッチング関数
const findWalletTxnDescription = (
  payment: Payment,
  walletTxns: GetWalletTxtListResponse["wallet_txns"],
): string | undefined => {
  const matched = walletTxns.find(
    (txn) =>
      txn.date === payment.date &&
      txn.amount === payment.amount &&
      txn.walletable_id === payment.from_walletable_id,
  );
  return matched?.description;
};

export const receiptsRoute = app.get("/", async (c) => {
  const { DATABASE_URL } = c.env;
  const currentUser = c.get("currentUser");

  if (!currentUser) {
    return c.json({ error: "認証が必要です" }, 401);
  }

  // ページングパラメータ
  const page = Number.parseInt(c.req.query("page") || "1", 10);
  const limit = Number.parseInt(c.req.query("limit") || "10", 10);

  const prisma = getPrisma(DATABASE_URL);
  const user = await prisma.user.findUnique({
    where: { lineUserId: currentUser.lineUserId },
    include: { activeCompany: true },
  });

  const company = user?.activeCompany;

  if (!company) {
    return c.json({ error: "事業所が見つかりませんでした" }, 401);
  }

  try {
    const result = await refreshAccessToken({
      env: c.env,
      refreshToken: company.refreshToken,
    });

    const privateApi = new FreeePrivateApi({
      accessToken: result.accessToken,
    });

    // dealsとwallet_txnsを並行取得
    const [deals, walletTxns] = await Promise.all([
      privateApi.getDeals({ companyId: company.companyId }),
      privateApi.getWalletTxnList({ companyId: company.companyId }),
    ]);

    // 領収書が必要な取引をフィルタリング
    const receiptRequiredDeals = deals.filter((deal) => {
      const isRequiredReceipt = deal.details.some((detail) =>
        RECEIPT_REQUIRED_ITEMS.some(
          (item) => item.id === detail.account_item_id,
        ),
      );
      const noReceipt = deal.receipts.length === 0;
      return isRequiredReceipt && noReceipt;
    });

    // ページング計算
    const totalCount = receiptRequiredDeals.length;
    const totalPages = Math.ceil(totalCount / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    // ページング適用してマッピング
    const paginatedDeals = receiptRequiredDeals
      .slice(startIndex, endIndex)
      .map((deal) => ({
        id: deal.id,
        date: deal.issue_date,
        url: `https://secure.freee.co.jp/reports/journals?deal_id=${deal.id}&openExternalBrowser=1`,
        amount: deal.amount,
        accountItemNames: deal.details
          .map(
            (detail) =>
              RECEIPT_REQUIRED_ITEMS.find(
                (item) => item.id === detail.account_item_id,
              )?.name,
          )
          .filter((name): name is string => name !== undefined),
        paymentDescriptions: deal.payments
          .map((payment) => findWalletTxnDescription(payment, walletTxns))
          .filter((desc): desc is string => desc !== undefined),
      }));

    return c.json({
      deals: paginatedDeals,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching receipts:", error);
    return c.json({ error: "データの取得に失敗しました" }, 500);
  }
});
