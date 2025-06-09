export type GetAccessTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
  created_at: string;
  company_id: number;
};

export type GetWalletTxnResponse = {
  wallet_txn: {
    id: number;
    status: 1 | 2 | 3 | 4 | 6;
    amount: number;
    balance: number;
    date: string;
    entry_side: "income" | "expense";
    walletable_type: "bank_account" | "credit_card" | "wallet";
    walletable_id: number;
    description: string;
    due_amount: number;
    rule_matched: boolean;
  };
};

export type GetWalletTxtListResponse = {
  wallet_txns: {
    id: number;
    status: 1 | 2 | 3 | 4 | 6;
    amount: number;
    balance: number;
    date: string;
    entry_side: "income" | "expense";
    walletable_type: "bank_account" | "credit_card" | "wallet";
    walletable_id: number;
    description: string;
    due_amount: number;
    rule_matched: boolean;
  }[];
};

export type GetCurrentUserResponse = {
  id: number;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  first_name_kana: string;
  last_name_kana: string;
  companies: {
    id: number;
    display_name: string;
    role: string;
    use_custom_role: boolean;
    advisor_id: number;
  }[];
};

export type GetDealsResponse = {
  deals: {
    id: number;
    company_id: number;
    issue_date: string;
    due_date: string;
    amount: number;
    due_amount: number;
    type: string;
    partner_id: number;
    partner_code: string;
    ref_number: string;
    status: string;
    deal_origin_name: string;
    details: [
      {
        id: number;
        account_item_id: number;
        tax_code: number;
        item_id: number | null;
        section_id: number | null;
        tag_ids: number[];
        amount: number;
        vat: number;
        description: string;
        entry_side: "debit" | "credit";
      },
    ];
    receipts: { id: number }[];
  }[];
  meta: {
    total_count: number;
  };
};

export type GetCompaniesResponse = {
  companies: {
    id: number;
    name: string | null;
    name_kana: string | null;
    display_name: string;
    company_number: string;
    role: string;
  }[];
};

export type GetWalletablesResponse = {
  walletables: {
    id: number;
    name: string;
    bank_id: number;
    type: string;
    last_synced_at: string;
    sync_status:
      | "success"
      | "disabled"
      | "syncing"
      | "token_refresh_error"
      | "unsupported"
      | "other_error";
    last_balance: number;
    walletable_balance: number;
  }[];
};

export type GetTagsResponse = {
  tags: {
    id: number;
    company_id: number;
    name: string;
    shortcut1: string;
    shortcut2: string;
    update_date: string;
  }[];
};

export type GetTrialBalanceResponse = {
  trial_pl: {
    company_id: number;
    fiscal_year: number;
    breakdown_display_type?: string;
    created_at: string;
    balances: {
      account_item_id?: number;
      account_item_name?: string;
      hierarchy_level: number;
      account_category_name: string;
      total_line?: boolean;
      parent_account_category_name?: string;
      opening_balance: number;
      debit_amount: number;
      credit_amount: number;
      closing_balance: number;
      composition_ratio: number;
    }[];
  };
};
