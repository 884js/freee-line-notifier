import {
  formatJST,
  lastStartOfYear,
} from "../../../../apps/server/app/lib/date-fns";
import { privateApi, publicApi } from "./base";
import type {
  GetAccessTokenResponse,
  GetCompaniesResponse,
  GetCurrentUserResponse,
  GetDealsResponse,
  GetTagsResponse,
  GetTrialBalanceResponse,
  GetWalletTxnResponse,
  GetWalletTxtListResponse,
  GetWalletablesResponse,
} from "./types";
export * from "./constants";
export * from "./types";

export class FreeePublicApi {
  constructor(
    private readonly payload: { clientId: string; clientSecret: string },
  ) {}

  async getAccessToken({
    code,
    grantType,
    redirectUri,
  }: {
    grantType: "authorization_code" | "refresh_token";
    code: string;
    redirectUri: string;
  }) {
    const result = await publicApi("/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: grantType,
        client_id: this.payload.clientId,
        client_secret: this.payload.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    }).then(async (res) => await res.json());
    return result as GetAccessTokenResponse;
  }

  async refreshAccessToken({
    refreshToken,
  }: {
    refreshToken: string;
  }) {
    const result = await publicApi("/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.payload.clientId,
        client_secret: this.payload.clientSecret,
        refresh_token: refreshToken,
      }),
    }).then(async (res) => await res.json());

    return result as GetAccessTokenResponse;
  }
}

export class FreeePrivateApi {
  private accessToken?: string;

  constructor(readonly payload: { accessToken?: string }) {
    this.accessToken = payload.accessToken;
  }

  getWalletables = async ({
    companyId,
  }: {
    companyId: number;
  }) => {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
      with_balance: "true",
      with_last_synced_at: "true",
      with_sync_status: "true",
    });

    const { walletables } = await privateApi(
      `walletables?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    ).then(async (res) => (await res.json()) as GetWalletablesResponse);

    return walletables;
  };

  getWalletTxn = async ({
    id,
    companyId,
  }: {
    id: number;
    companyId: number;
  }) => {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
    });

    const { wallet_txn } = await privateApi(
      `wallet_txns/${id}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      },
    ).then(async (res) => (await res.json()) as GetWalletTxnResponse);

    return wallet_txn;
  };

  getWalletTxnList = async ({ companyId }: { companyId: number }) => {
    const PER_PAGE = 100;
    let allWalletTxns: GetWalletTxtListResponse["wallet_txns"] = [];
    let offset = 0;

    while (true) {
      const params = new URLSearchParams({
        company_id: companyId.toString(),
        limit: PER_PAGE.toString(),
        offset: offset.toString(),
      });

      const result = await privateApi(`wallet_txns?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }).then(async (res) => (await res.json()) as GetWalletTxtListResponse);

      if (!result.wallet_txns?.length) {
        break;
      }

      allWalletTxns = [...allWalletTxns, ...result.wallet_txns];
      offset += PER_PAGE;
    }

    return allWalletTxns;
  };

  getCurrentUser = async () => {
    const result = await privateApi("/users/me", {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    }).then(async (res) => await res.json());

    return result as GetCurrentUserResponse;
  };

  getDeals = async ({ companyId }: { companyId: number }) => {
    const PER_PAGE = 100;
    const startDate = formatJST(lastStartOfYear(new Date()), "yyyy-MM-dd");

    let allDeals: GetDealsResponse["deals"] = [];
    let offset = 0;

    while (true) {
      const params = new URLSearchParams({
        company_id: companyId.toString(),
        status: "settled",
        start_issue_date: startDate,
        limit: PER_PAGE.toString(),
        offset: offset.toString(),
      });

      const result = await privateApi(`deals?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }).then(async (res) => (await res.json()) as GetDealsResponse);

      if (!result.deals?.length) {
        break;
      }

      allDeals = [...allDeals, ...result.deals];
      offset += PER_PAGE;
    }

    return allDeals;
  };

  createDeal = async (body: unknown) => {
    const result = await privateApi("deals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(body),
    })
      .then(async (res) => await res.json())
      .catch(async (res) => {
        return await res.json();
      });

    return result as GetDealsResponse;
  };

  getCompanies = async () => {
    const response = await privateApi("companies", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    return (await response.json()) as GetCompaniesResponse;
  };

  getTags = async ({ companyId }: { companyId: number }) => {
    const response = await privateApi(`tags?company_id=${companyId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
    const { tags } = (await response.json()) as GetTagsResponse;
    return tags;
  };

  getTrialBalance = async ({
    companyId,
    fiscalYear,
    startMonth,
    endMonth,
  }: {
    companyId: number;
    fiscalYear?: number;
    startMonth?: number;
    endMonth?: number;
  }) => {
    const params = new URLSearchParams({
      company_id: companyId.toString(),
    });

    if (fiscalYear) params.append("fiscal_year", fiscalYear.toString());
    if (startMonth) params.append("start_month", startMonth.toString());
    if (endMonth) params.append("end_month", endMonth.toString());

    const url = `reports/trial_bs?${params.toString()}`;
    console.log("Requesting trial balance:", url);

    const response = await privateApi(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Trial balance API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Trial balance API failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Trial balance response keys:", Object.keys(data as object));
    return data as GetTrialBalanceResponse;
  };
}
