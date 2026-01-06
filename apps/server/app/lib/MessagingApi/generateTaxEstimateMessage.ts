import type { messagingApi } from "@line/bot-sdk";
import type { GenerateDailyReportType } from "../../functions/dailyReportModule";

export const generateTaxEstimateMessage = (
  taxEstimate: GenerateDailyReportType["taxEstimate"],
): messagingApi.FlexComponent => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ja-JP", {
      style: "currency",
      currency: "JPY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "text",
        text: "【参考】所得税",
        weight: "bold",
        size: "sm",
        margin: "sm",
      },
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
            text: "所得",
            flex: 1,
            size: "xs",
            color: "#666666",
          },
          {
            type: "text",
            text: formatCurrency(taxEstimate.income),
            flex: 0,
            size: "xs",
            align: "end",
          },
        ],
        margin: "sm",
      },
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: "課税所得",
            flex: 1,
            size: "xs",
            color: "#666666",
          },
          {
            type: "text",
            text: formatCurrency(taxEstimate.taxableIncome),
            flex: 0,
            size: "xs",
            align: "end",
          },
        ],
      },
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: "概算所得税",
            flex: 1,
            size: "xs",
            color: "#666666",
            weight: "bold",
          },
          {
            type: "text",
            text: formatCurrency(taxEstimate.estimatedTax),
            flex: 0,
            size: "xs",
            align: "end",
            weight: "bold",
            color: taxEstimate.estimatedTax > 0 ? "#ff4444" : "#00c73c",
          },
        ],
        margin: "sm",
      },
      {
        type: "text",
        text: "※基礎控除+青色申告控除のみ",
        size: "xxs",
        color: "#999999",
        margin: "sm",
      },
    ],
  };
};
