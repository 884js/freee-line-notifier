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

  const result = await refreshAccessToken({
    env,
    refreshToken: company.refreshToken,
  });

  const privateApi = new FreeePrivateApi({
    accessToken: result.accessToken,
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const [deals, currentMonthTrialBalance, lastMonthTrialBalance] =
    await Promise.all([
      await privateApi.getDeals({
        companyId: company.companyId,
      }),
      await privateApi.getTrialBalance({
        companyId: company.companyId,
        fiscalYear: currentYear,
        startMonth: currentMonth,
        endMonth: currentMonth,
      }),
      await privateApi.getTrialBalance({
        companyId: company.companyId,
        fiscalYear: lastMonthYear,
        startMonth: lastMonth,
        endMonth: lastMonth,
      }),
    ]);

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
  );

  return {
    companyId: company.companyId,
    deals: tagDeals,
    monthlyProgress,
  };
};

const calculateMonthlyProgress = (
  currentMonth: Awaited<ReturnType<FreeePrivateApi["getTrialBalance"]>>,
  lastMonth: Awaited<ReturnType<FreeePrivateApi["getTrialBalance"]>>,
) => {
  const getSalesAmount = (trialBalance: typeof currentMonth) => {
    const salesAccounts = trialBalance.trial_balance.balances.filter(
      (balance) =>
        balance.account_item_name.includes("売上") &&
        !balance.account_item_name.includes("原価"),
    );
    return salesAccounts.reduce(
      (sum, account) => sum + account.credit_amount - account.debit_amount,
      0,
    );
  };

  const getExpenseAmount = (trialBalance: typeof currentMonth) => {
    const expenseAccounts = trialBalance.trial_balance.balances.filter(
      (balance) =>
        balance.account_item_name.includes("費") ||
        balance.account_item_name.includes("経費"),
    );
    return expenseAccounts.reduce(
      (sum, account) => sum + account.debit_amount - account.credit_amount,
      0,
    );
  };

  const currentSales = getSalesAmount(currentMonth);
  const currentExpenses = getExpenseAmount(currentMonth);
  const lastSales = getSalesAmount(lastMonth);
  const lastExpenses = getExpenseAmount(lastMonth);

  const salesGrowthRate =
    lastSales > 0 ? ((currentSales - lastSales) / lastSales) * 100 : 0;
  const expenseGrowthRate =
    lastExpenses > 0
      ? ((currentExpenses - lastExpenses) / lastExpenses) * 100
      : 0;
  const currentProfit = currentSales - currentExpenses;
  const profitMargin =
    currentSales > 0 ? (currentProfit / currentSales) * 100 : 0;

  return {
    currentSales,
    currentExpenses,
    currentProfit,
    lastSales,
    lastExpenses,
    salesGrowthRate,
    expenseGrowthRate,
    profitMargin,
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

  const altText = `${today} 売上${formatCurrency(monthlyProgress.currentSales)}(${formatPercentage(monthlyProgress.salesGrowthRate)}) 利益${formatCurrency(monthlyProgress.currentProfit)} 要領収書${deals.length}件`;

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
    console.log("User found:", { id: user.id, companyId: user.activeCompany?.companyId });
    
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
