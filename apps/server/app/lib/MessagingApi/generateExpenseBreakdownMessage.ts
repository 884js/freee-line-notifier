import type { messagingApi } from "@line/bot-sdk";
import type { GenerateDailyReportType } from "../../functions/dailyReportModule";

export const generateExpenseBreakdownMessage = (
  expenseBreakdown: GenerateDailyReportType["expenseBreakdown"],
): messagingApi.FlexComponent => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (!expenseBreakdown || expenseBreakdown.length === 0) {
    return {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "経費内訳",
          weight: "bold",
          size: "sm",
          margin: "sm",
        },
        {
          type: "text",
          text: "経費データがありません",
          size: "xs",
          color: "#999999",
          margin: "sm",
        },
      ],
    };
  }

  const expenseItems: messagingApi.FlexComponent[] = expenseBreakdown.map(
    (expense) => ({
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "text",
          text: expense.name,
          flex: 1,
          size: "xs",
          color: "#666666",
        },
        {
          type: "text",
          text: formatCurrency(expense.amount),
          flex: 0,
          size: "xs",
          align: "end",
        },
      ],
    }),
  );

  return {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "text",
        text: "経費内訳",
        weight: "bold",
        size: "sm",
        margin: "sm",
      },
      {
        type: "separator",
        margin: "sm",
      },
      ...expenseItems,
    ],
  };
};
