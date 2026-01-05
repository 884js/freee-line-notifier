import type { messagingApi } from "@line/bot-sdk";
import type { GenerateDailyReportType } from "../../functions/dailyReportModule";
import { generateExpenseBreakdownMessage } from "./generateExpenseBreakdownMessage";
import { generateMonthlyProgressMessage } from "./generateMonthlyProgressMessage";

export const generateDailyReportMessage = ({
  deals,
  monthlyProgress,
  expenseBreakdown,
}: GenerateDailyReportType) => {
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
        generateMonthlyProgressMessage(monthlyProgress),
        {
          type: "separator",
          margin: "sm",
        },
        generateExpenseBreakdownMessage(expenseBreakdown),
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
              text: "領収書が必要な取引",
              flex: 1,
              size: "sm",
              color: "#666666",
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
  } satisfies messagingApi.FlexBubble;
};
