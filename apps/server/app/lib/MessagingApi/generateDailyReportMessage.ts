import type { messagingApi } from "@line/bot-sdk";
import type { GenerateDailyReportType } from "../../functions/dailyReportModule";
import { generateExpenseBreakdownMessage } from "./generateExpenseBreakdownMessage";
import { generateMonthlyProgressMessage } from "./generateMonthlyProgressMessage";
import { generateTaxEstimateMessage } from "./generateTaxEstimateMessage";

export const generateDailyReportMessage = ({
  deals,
  monthlyProgress,
  expenseBreakdown,
  fiscalYear,
  taxEstimate,
}: GenerateDailyReportType) => {
  // 領収書が必要な取引がある場合のみfooterにボタンを表示
  const footer: messagingApi.FlexBox | undefined =
    deals.length > 0
      ? {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              action: {
                type: "postback",
                label: "詳細を見る",
                data: "action=receipt_list",
              },
              style: "primary",
              color: "#ff4444",
              height: "sm",
            },
          ],
        }
      : undefined;

  return {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "デイリーレポート",
          weight: "bold",
          size: "xl",
        },
        {
          type: "separator",
          margin: "sm",
        },
        generateMonthlyProgressMessage(monthlyProgress, fiscalYear),
        {
          type: "separator",
          margin: "sm",
        },
        generateExpenseBreakdownMessage(expenseBreakdown),
        {
          type: "separator",
          margin: "sm",
        },
        generateTaxEstimateMessage(taxEstimate),
        {
          type: "separator",
          margin: "sm",
        },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: deals.length > 0 ? "⚠️ 領収書が必要" : "✅ 領収書が必要",
              flex: 1,
              size: "sm",
              color: deals.length > 0 ? "#ff4444" : "#00c73c",
              weight: "bold",
            },
            {
              type: "text",
              text: `${deals.length}件`,
              flex: 0,
              size: "sm",
              align: "end",
              weight: "bold",
              color: deals.length > 0 ? "#ff4444" : "#00c73c",
            },
          ],
          margin: "sm",
        },
      ],
    },
    footer,
  } satisfies messagingApi.FlexBubble;
};
