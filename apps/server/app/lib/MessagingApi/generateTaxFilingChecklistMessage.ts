import type { messagingApi } from "@line/bot-sdk";

export const generateTaxFilingChecklistMessage =
  (): messagingApi.TextMessage => {
    const checklist = `【確定申告チェックリスト】

▼ 収入関連
□ 売上の集計
□ 源泉徴収票の収集

▼ 経費関連
□ 経費の整理・領収書確認
□ 減価償却の計算

▼ 控除証明書
□ 社会保険料控除
□ 生命保険料控除
□ 医療費控除
□ ふるさと納税証明書
□ 住宅ローン控除書類

▼ 申告準備
□ freeeで確定申告書作成
□ マイナンバー確認
□ 還付先口座の確認
□ e-Taxで電子申告
□ 申告データの保存

期限: 3月15日
※青色申告特別控除は3/15必着
※消費税申告（課税事業者）: 3/31`;

    return {
      type: "text",
      text: checklist,
    };
  };
