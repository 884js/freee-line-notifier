import type { messagingApi } from "@line/bot-sdk";
import type { GenerateDailyReportType } from "../../functions/dailyReportModule";

export const generateMonthlyProgressMessage = (
  monthlyProgress: GenerateDailyReportType["monthlyProgress"],
  fiscalYear: number,
): messagingApi.FlexComponent => {
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

  const getGrowthIcon = (rate: number) => {
    if (rate > 10) return "📈";
    if (rate > 0) return "📊";
    if (rate === 0) return "➡️";
    return "📉";
  };

  return {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "text",
        text: `${fiscalYear}年 損益`,
        weight: "bold",
        size: "lg",
        margin: "sm",
      },
      {
        type: "separator",
        margin: "sm",
      },
      // 売上セクション
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: "💰 売上",
            flex: 1,
            size: "sm",
            color: "#666666",
          },
          {
            type: "text",
            text: `${getGrowthIcon(monthlyProgress.salesGrowthRate)} ${formatPercentage(monthlyProgress.salesGrowthRate)}`,
            flex: 0,
            size: "xs",
            color: monthlyProgress.salesGrowthRate >= 0 ? "#00c73c" : "#ff4444",
          },
        ],
        margin: "sm",
      },
      {
        type: "text",
        text: formatCurrency(monthlyProgress.currentSales),
        size: "xl",
        weight: "bold",
        align: "end",
      },
      {
        type: "separator",
        margin: "sm",
      },
      // 経費セクション
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: "💸 経費",
            flex: 1,
            size: "sm",
            color: "#666666",
          },
          {
            type: "text",
            text: `月+${formatCurrency(monthlyProgress.monthlyExpenseIncrease)}`,
            flex: 0,
            size: "xs",
            color: "#999999",
          },
        ],
        margin: "sm",
      },
      {
        type: "text",
        text: formatCurrency(monthlyProgress.currentExpenses),
        size: "md",
        weight: "bold",
        align: "end",
      },
      {
        type: "separator",
        margin: "sm",
      },
      // 利益セクション
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: "📊 利益",
            flex: 1,
            size: "sm",
            color: "#666666",
            weight: "bold",
          },
          {
            type: "text",
            text: `利益率 ${monthlyProgress.profitMargin.toFixed(1)}%`,
            flex: 0,
            size: "xs",
            color: monthlyProgress.profitMargin > 20 ? "#00c73c" : "#666666",
          },
        ],
        margin: "sm",
      },
      {
        type: "text",
        text: formatCurrency(monthlyProgress.currentProfit),
        size: "xl",
        weight: "bold",
        align: "end",
        color: monthlyProgress.currentProfit >= 0 ? "#00c73c" : "#ff4444",
      },
    ],
  };
};
