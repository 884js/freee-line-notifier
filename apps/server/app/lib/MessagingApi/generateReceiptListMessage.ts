import type { messagingApi } from "@line/bot-sdk";
import type { GenerateDailyReportType } from "../../functions/dailyReportModule";

type Deal = GenerateDailyReportType["deals"][number];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    minimumFractionDigits: 0,
  }).format(amount);
};

const generateDealItem = (deal: Deal): messagingApi.FlexComponent => {
  return {
    type: "box",
    layout: "vertical",
    contents: [
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: deal.date,
            size: "sm",
            color: "#999999",
            flex: 1,
          },
          {
            type: "text",
            text: formatCurrency(deal.amount),
            size: "sm",
            weight: "bold",
            align: "end",
            flex: 0,
          },
        ],
      },
      {
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: deal.accountItemNames.join(", "),
            size: "xs",
            color: "#666666",
            flex: 1,
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "確認 →",
                size: "xs",
                color: "#2c67f2",
                align: "end",
              },
            ],
            flex: 0,
            action: {
              type: "uri",
              label: "freeeで確認",
              uri: deal.url,
            },
          },
        ],
        margin: "xs",
      },
    ],
    margin: "md",
    paddingBottom: "md",
    borderColor: "#eeeeee",
    borderWidth: "0px 0px 1px 0px",
  };
};

export const generateReceiptListMessage = (
  deals: GenerateDailyReportType["deals"],
): messagingApi.FlexMessage => {
  if (deals.length === 0) {
    return {
      type: "flex",
      altText: "領収書が必要な取引はありません",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "✅ 領収書が必要な取引はありません",
              size: "md",
              color: "#00c73c",
              weight: "bold",
              align: "center",
            },
          ],
        },
      },
    };
  }

  const dealItems: messagingApi.FlexComponent[] = deals.map(generateDealItem);

  return {
    type: "flex",
    altText: `領収書が必要な取引 ${deals.length}件`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "📋 領収書が必要な取引",
            weight: "bold",
            size: "lg",
          },
          {
            type: "text",
            text: `全${deals.length}件`,
            size: "sm",
            color: "#ff4444",
            margin: "xs",
          },
          {
            type: "separator",
            margin: "md",
          },
          ...dealItems,
        ],
      },
    },
  };
};
