import { FreeePrivateApi } from "@freee-line-notifier/external-api/freee";
import { getPrisma } from "@freee-line-notifier/prisma";
import type { Env } from "hono";
import { generateDailyReportMessage } from "../lib/MessagingApi/generateDailyReportMessage";
import { formatJST } from "../lib/date-fns";
import { refreshAccessToken } from "./refreshAccessToken";

const RECEIPT_REQUIRED_ITEMS = [
  {
    name: "通信費",
    id: 626477503,
  },
  {
    name: "交際費",
    id: 626477505,
  },
  {
    name: "消耗品費",
    id: 626477508,
  },
  {
    name: "事務用品費",
    id: 626477509,
  },
  {
    name: "会議費",
    id: 626477529,
  },
  {
    name: "新聞図書費",
    id: 626477530,
  },
  {
    name: "雑費",
    id: 626477534,
  },
  {
    name: "工具器具備品",
    id: 626477442,
  },
  {
    name: "ソフトウェア",
    id: 626477543,
  },
  {
    name: "旅費交通費",
    id: 626477502,
  },
  {
    name: "租税公課",
    id: 626477498,
  },
];

const generateDailyReport = async ({
  env,
  lineUserId,
}: { env: Env["Bindings"]; lineUserId: string }) => {
  console.log("generateDailyReport started for user:", lineUserId);

  try {
    const { DATABASE_URL } = env;
    const prisma = getPrisma(DATABASE_URL);
    const user = await prisma.user.findFirstOrThrow({
      where: {
        lineUserId,
      },
      include: {
        activeCompany: true,
      },
    });
    const company = user.activeCompany;
    console.log("User and company found:", {
      userId: user.id,
      companyId: company?.companyId,
    });

    console.log("Refreshing access token...");
    const result = await refreshAccessToken({
      env,
      refreshToken: company.refreshToken,
    });
    console.log("Access token refreshed successfully");

    const privateApi = new FreeePrivateApi({
      accessToken: result.accessToken,
    });

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    console.log("Date calculation:", {
      now: now.toISOString(),
      currentMonth,
      currentYear,
      lastMonth,
      lastMonthYear,
    });

    console.log("Fetching data from freee API...");
    const [
      deals,
      currentMonthTrialBalance,
      lastMonthTrialBalance,
      thisYearTrialBalance,
    ] = await Promise.all([
      privateApi.getDeals({
        companyId: company.companyId,
      }),
      privateApi.getTrialBalance({
        companyId: company.companyId,
        fiscalYear: currentYear,
        endMonth: currentMonth,
      }),
      privateApi.getTrialBalance({
        companyId: company.companyId,
        fiscalYear: lastMonthYear,
        endMonth: lastMonth,
      }),
      privateApi.getTrialBalance({
        companyId: company.companyId,
        fiscalYear: currentYear,
      }),
    ]);
    console.log("freee API data fetched successfully");
    console.log(
      "Current month trial balance structure:",
      JSON.stringify(currentMonthTrialBalance, null, 2),
    );
    console.log(
      "Last month trial balance structure:",
      JSON.stringify(lastMonthTrialBalance, null, 2),
    );
    console.log(
      "This year trial balance structure:",
      JSON.stringify(thisYearTrialBalance, null, 2),
    );

    const tagDeals = deals
      .filter((deal) => {
        const isRequiredReceipt = deal.details.some((detail) => {
          return RECEIPT_REQUIRED_ITEMS.some(
            (item) => item.id === detail.account_item_id,
          );
        });
        const noReceipt = deal.receipts.length === 0;
        return isRequiredReceipt && noReceipt;
      })
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
          .filter((name) => name !== undefined),
      }));

    const monthlyProgress = calculateMonthlyProgress(
      currentMonthTrialBalance,
      lastMonthTrialBalance,
      thisYearTrialBalance,
    );

    console.log("Daily report generation completed successfully");
    return {
      companyId: company.companyId,
      deals: tagDeals,
      monthlyProgress,
    };
  } catch (error) {
    console.error("Error in generateDailyReport:", error);
    throw error;
  }
};

const calculateMonthlyProgress = (
  currentMonth: Awaited<ReturnType<FreeePrivateApi["getTrialBalance"]>>,
  lastMonth: Awaited<ReturnType<FreeePrivateApi["getTrialBalance"]>>,
  thisYear: Awaited<ReturnType<FreeePrivateApi["getTrialBalance"]>>,
) => {
  console.log("Calculating monthly progress...");

  // 安全性チェック
  if (
    !currentMonth?.trial_pl?.balances ||
    !lastMonth?.trial_pl?.balances ||
    !thisYear?.trial_pl?.balances
  ) {
    console.warn("Trial P&L data is incomplete, using fallback values");
    return {
      currentSales: 0,
      currentExpenses: 0,
      currentProfit: 0,
      lastSales: 0,
      lastExpenses: 0,
      salesGrowthRate: 0,
      expenseGrowthRate: 0,
      profitMargin: 0,
      monthlyExpenseIncrease: 0,
    };
  }

  const getSalesAmount = (trialBalance: typeof currentMonth) => {
    if (!trialBalance?.trial_pl?.balances) return 0;
    // 収入金額の合計行を取得
    const salesTotal = trialBalance.trial_pl.balances.find(
      (balance) =>
        balance.account_category_name === "収入金額" && balance.total_line,
    );

    if (salesTotal) {
      console.log("Sales total found:", salesTotal.closing_balance);
      return salesTotal.closing_balance;
    }

    // フォールバック: 売上高個別項目を合計
    const salesAccounts = trialBalance.trial_pl.balances.filter(
      (balance) =>
        balance.account_item_name?.includes("売上") &&
        !balance.account_item_name.includes("原価"),
    );
    console.log("Sales accounts found:", salesAccounts.length);
    return salesAccounts.reduce(
      (sum, account) => sum + account.closing_balance,
      0,
    );
  };

  const getExpenseAmount = (trialBalance: typeof currentMonth) => {
    if (!trialBalance?.trial_pl?.balances) return 0;
    // 経費の合計行を取得
    const expenseTotal = trialBalance.trial_pl.balances.find(
      (balance) =>
        balance.account_category_name === "経費" && balance.total_line,
    );

    if (expenseTotal) {
      console.log("Expense total found:", expenseTotal.closing_balance);
      return expenseTotal.closing_balance;
    }

    // フォールバック: 経費個別項目を合計
    const expenseAccounts = trialBalance.trial_pl.balances.filter(
      (balance) =>
        balance.account_item_name?.includes("費") ||
        balance.account_item_name?.includes("経費"),
    );
    console.log("Expense accounts found:", expenseAccounts.length);
    return expenseAccounts.reduce(
      (sum, account) => sum + account.closing_balance,
      0,
    );
  };

  // thisYear（年度累計）を主要データソースとして使用
  const currentSales = getSalesAmount(thisYear);
  const currentExpenses = getExpenseAmount(thisYear);

  // 月次増加分の計算は現在月と前月のデータを使用
  const currentMonthSales = getSalesAmount(currentMonth);
  const lastMonthSales = getSalesAmount(lastMonth);
  const currentMonthExpenses = getExpenseAmount(currentMonth);
  const lastMonthExpenses = getExpenseAmount(lastMonth);

  const salesGrowthRate =
    lastMonthSales > 0
      ? ((currentMonthSales - lastMonthSales) / lastMonthSales) * 100
      : 0;
  const expenseGrowthRate =
    lastMonthExpenses > 0
      ? ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100
      : 0;
  const currentProfit = currentSales - currentExpenses;
  const profitMargin =
    currentSales > 0 ? (currentProfit / currentSales) * 100 : 0;

  // 今月の経費増加分を計算
  const monthlyExpenseIncrease = currentMonthExpenses - lastMonthExpenses;

  return {
    currentSales,
    currentExpenses,
    currentProfit,
    lastSales: lastMonthSales,
    lastExpenses: lastMonthExpenses,
    salesGrowthRate,
    expenseGrowthRate,
    profitMargin,
    monthlyExpenseIncrease,
  };
};

const generateLineMessage = (result: GenerateDailyReportType) => {
  const today = formatJST(new Date(), "yyyy/MM/dd");
  const { monthlyProgress, deals } = result;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)}%`;
  };

  const altText = `${today} 累計売上${formatCurrency(monthlyProgress.currentSales)}(${formatPercentage(monthlyProgress.salesGrowthRate)}) 利益${formatCurrency(monthlyProgress.currentProfit)} 要領収書${deals.length}件`;

  return {
    type: "flex" as const,
    altText,
    contents: generateDailyReportMessage(result),
  } as const;
};

const testGenerate = async ({
  env,
  lineUserId,
}: { env: Env["Bindings"]; lineUserId: string }) => {
  console.log("testGenerate called with lineUserId:", lineUserId);

  try {
    const { DATABASE_URL } = env;
    console.log("DATABASE_URL exists:", !!DATABASE_URL);

    const prisma = getPrisma(DATABASE_URL);
    console.log("Prisma client created");

    const user = await prisma.user.findFirstOrThrow({
      where: {
        lineUserId,
      },
      include: {
        activeCompany: true,
      },
    });
    console.log("User found:", {
      id: user.id,
      companyId: user.activeCompany?.companyId,
    });

    return {
      companyId: user.activeCompany?.companyId || 0,
      deals: [],
      monthlyProgress: {
        currentSales: 1000000,
        currentExpenses: 500000,
        currentProfit: 500000,
        lastSales: 800000,
        lastExpenses: 450000,
        salesGrowthRate: 25.0,
        expenseGrowthRate: 11.1,
        profitMargin: 50.0,
      },
    };
  } catch (error) {
    console.error("Error in testGenerate:", error);
    throw error;
  }
};

export const dailyReportModule = {
  generate: generateDailyReport,
  testGenerate,
  message: generateLineMessage,
};

export type GenerateDailyReportType = Awaited<
  ReturnType<typeof generateDailyReport>
>;
