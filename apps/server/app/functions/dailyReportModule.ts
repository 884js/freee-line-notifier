import { FreeePrivateApi } from "@freee-line-notifier/external-api/freee";
import { getPrisma } from "@freee-line-notifier/prisma";
import type { Env } from "hono";
import { generateDailyReportMessage } from "../lib/MessagingApi/generateDailyReportMessage";
import { formatJST } from "../lib/date-fns";
import { refreshAccessToken } from "./refreshAccessToken";

// 会計年度を取得（存在しなければ前年度にフォールバック）
const getTrialBalanceWithFallback = async (
  privateApi: FreeePrivateApi,
  companyId: number,
  year: number,
  endMonth?: number,
): Promise<Awaited<ReturnType<FreeePrivateApi["getTrialBalance"]>>> => {
  try {
    return await privateApi.getTrialBalance({
      companyId,
      fiscalYear: year,
      endMonth,
    });
  } catch (error) {
    // 会計期間が存在しない場合は前年度にフォールバック
    if (error instanceof Error && error.message.includes("400")) {
      console.log(`Fiscal year ${year} not found, falling back to ${year - 1}`);
      return await privateApi.getTrialBalance({
        companyId,
        fiscalYear: year - 1,
        endMonth: endMonth ? 12 : undefined,
      });
    }
    throw error;
  }
};

// 経費の科目別データを抽出
const getExpenseBreakdown = (
  trialBalance: Awaited<ReturnType<FreeePrivateApi["getTrialBalance"]>>,
) => {
  if (!trialBalance?.trial_pl?.balances) return [];

  return trialBalance.trial_pl.balances
    .filter(
      (balance) =>
        balance.account_category_name === "経費" &&
        !balance.total_line &&
        balance.closing_balance > 0 &&
        balance.account_item_name,
    )
    .map((balance) => ({
      name: balance.account_item_name as string,
      amount: balance.closing_balance,
    }))
    .sort((a, b) => b.amount - a.amount);
};

// 所得税の概算計算（基礎控除 + 青色申告特別控除）
const DEDUCTIONS = {
  basic: 480_000, // 基礎控除
  blueReturn: 650_000, // 青色申告特別控除
};

const TAX_BRACKETS = [
  { limit: 1_950_000, rate: 0.05, deduction: 0 },
  { limit: 3_300_000, rate: 0.1, deduction: 97_500 },
  { limit: 6_950_000, rate: 0.2, deduction: 427_500 },
  { limit: 9_000_000, rate: 0.23, deduction: 636_000 },
  { limit: 18_000_000, rate: 0.33, deduction: 1_536_000 },
  { limit: 40_000_000, rate: 0.4, deduction: 2_796_000 },
  { limit: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 4_796_000 },
];

const calculateTaxEstimate = (sales: number, expenses: number) => {
  const income = sales - expenses;
  const totalDeduction = DEDUCTIONS.basic + DEDUCTIONS.blueReturn;
  const taxableIncome = Math.max(0, income - totalDeduction);

  const bracketIndex = TAX_BRACKETS.findIndex((b) => taxableIncome <= b.limit);
  const bracket = TAX_BRACKETS[bracketIndex];
  const estimatedTax = bracket
    ? Math.floor(taxableIncome * bracket.rate - bracket.deduction)
    : 0;

  // 現在の税率
  const currentRate = bracket ? bracket.rate * 100 : 45;

  // 次の税率境界（1つ下の税率区分）
  const prevBracket = bracketIndex > 0 ? TAX_BRACKETS[bracketIndex - 1] : null;
  const nextBracketLimit = prevBracket ? prevBracket.limit : null;
  const nextRate = prevBracket ? prevBracket.rate * 100 : null;

  // 次の税率まであといくら経費を使えるか
  // 課税所得がnextBracketLimit以下になるには、income - totalDeduction <= nextBracketLimit
  // つまり、income <= nextBracketLimit + totalDeduction
  // 経費を増やすと income = sales - (expenses + x) になるので
  // sales - expenses - x <= nextBracketLimit + totalDeduction
  // x >= taxableIncome - nextBracketLimit
  const amountToNextBracket =
    nextBracketLimit !== null ? taxableIncome - nextBracketLimit : null;

  return {
    income,
    taxableIncome,
    estimatedTax,
    currentRate,
    nextBracketLimit,
    amountToNextBracket,
    nextRate,
  };
};

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
      getTrialBalanceWithFallback(
        privateApi,
        company.companyId,
        currentYear,
        currentMonth,
      ),
      getTrialBalanceWithFallback(
        privateApi,
        company.companyId,
        lastMonthYear,
        lastMonth,
      ),
      getTrialBalanceWithFallback(privateApi, company.companyId, currentYear),
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

    const taxEstimate = calculateTaxEstimate(
      monthlyProgress.currentSales,
      monthlyProgress.currentExpenses,
    );

    return {
      companyId: company.companyId,
      deals: tagDeals,
      monthlyProgress,
      expenseBreakdown: getExpenseBreakdown(thisYearTrialBalance),
      fiscalYear: thisYearTrialBalance.trial_pl.fiscal_year,
      taxEstimate,
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
    const { DB } = env;
    console.log("DB exists:", !!DB);

    const prisma = getPrisma(DB);
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
        monthlyExpenseIncrease: 50000,
      },
      expenseBreakdown: [
        { name: "人件費", amount: 300000 },
        { name: "地代家賃", amount: 100000 },
        { name: "通信費", amount: 50000 },
        { name: "交際費", amount: 30000 },
        { name: "雑費", amount: 20000 },
      ],
      fiscalYear: new Date().getFullYear(),
      taxEstimate: calculateTaxEstimate(1000000, 500000),
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
