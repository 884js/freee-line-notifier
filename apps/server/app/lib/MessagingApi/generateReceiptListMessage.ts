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

const generateDealItem = (
  deal: Deal,
  isLast: boolean,
): messagingApi.FlexComponent[] => {
  const items: messagingApi.FlexComponent[] = [
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
      margin: "md",
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
      ],
      margin: "xs",
    },
    {
      type: "button",
      action: {
        type: "uri",
        label: "freeeで確認",
        uri: deal.url,
      },
      style: "link",
      height: "sm",
    },
  ];

  // 最後の項目以外はセパレーターを追加
  if (!isLast) {
    items.push({
      type: "separator",
      margin: "md",
    });
  }

  return items;
};

const MAX_DEALS_TO_DISPLAY = 10;

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

  // 件数が多い場合は制限
  const displayDeals = deals.slice(0, MAX_DEALS_TO_DISPLAY);
  const hasMore = deals.length > MAX_DEALS_TO_DISPLAY;

  const dealItems: messagingApi.FlexComponent[] = displayDeals.flatMap(
    (deal, index) => generateDealItem(deal, index === displayDeals.length - 1),
  );

  // 件数超過の場合は注記を追加
  if (hasMore) {
    dealItems.push({
      type: "separator",
      margin: "md",
    });
    dealItems.push({
      type: "text",
      text: `他${deals.length - MAX_DEALS_TO_DISPLAY}件あります`,
      size: "xs",
      color: "#999999",
      align: "center",
      margin: "md",
    });
  }

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
            text: "領収書が必要な取引",
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
