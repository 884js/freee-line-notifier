import type { messagingApi } from "@line/bot-sdk";

export const generateTaxRateTableMessage = (): messagingApi.TextMessage => {
  const table = `【所得税の税率表】
課税所得        税率
〜195万円       5%
〜330万円      10%
〜695万円      20%
〜900万円      23%
〜1,800万円    33%
〜4,000万円    40%
4,000万円〜    45%

※課税所得 = 所得 - 控除`;

  return {
    type: "text",
    text: table,
  };
};
