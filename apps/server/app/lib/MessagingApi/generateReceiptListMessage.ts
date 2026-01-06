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

const generateDealBubble = (deal: Deal): messagingApi.FlexBubble => {
  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: deal.date,
          size: "sm",
          color: "#999999",
        },
        {
          type: "text",
          text: formatCurrency(deal.amount),
          size: "xl",
          weight: "bold",
          margin: "sm",
        },
        {
          type: "text",
          text: deal.accountItemNames.join(", "),
          size: "xs",
          color: "#666666",
          margin: "sm",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "freeeで確認",
            uri: deal.url,
          },
          style: "primary",
          color: "#2c67f2",
          height: "sm",
        },
      ],
    },
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
              text: "領収書が必要な取引はありません",
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

  // 最大10件まで表示（LINE Flex Messageの制限）
  const displayDeals = deals.slice(0, 10);
  const hasMore = deals.length > 10;

  const bubbles: messagingApi.FlexBubble[] = displayDeals.map(generateDealBubble);

  // 10件以上ある場合は最後に「残りN件」のカードを追加
  if (hasMore) {
    bubbles.push({
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `他 ${deals.length - 10}件`,
            size: "lg",
            weight: "bold",
            align: "center",
          },
          {
            type: "text",
            text: "freeeで全件確認してください",
            size: "xs",
            color: "#666666",
            align: "center",
            margin: "sm",
          },
        ],
        justifyContent: "center",
        alignItems: "center",
      },
    });
  }

  return {
    type: "flex",
    altText: `領収書が必要な取引 ${deals.length}件`,
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
};
