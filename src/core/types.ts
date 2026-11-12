export interface SearchOpts {
  limit?: number;
  timeoutMs?: number;
}

export interface CatalogItem {
  source: string;
  sourceSku: string;
  mfrPartNumber: string | null;
  manufacturer: string | null;
  description: string;
  costCents: number | null;
  msrpCents: number | null;
  stock: number | null;
  fetchedAt: string;
  haloItemId?: number;
}

export interface PriceStock {
  sourceSku: string;
  costCents: number | null;
  stock: number | null;
  fetchedAt: string;
}

export interface AdapterHealth {
  ok: boolean;
  detail?: string;
  checkedAt: string;
}

export interface CatalogAdapter {
  id: string;
  search(q: string, opts?: SearchOpts): Promise<CatalogItem[]>;
  priceAndAvailability(skus: string[]): Promise<PriceStock[]>;
  healthCheck(): Promise<AdapterHealth>;
}

/**
 * Minimum payment record the contract can name before a Benji Pays fixture
 * exists. WP10 must align this to the captured response before storing more.
 */
export interface Payment {
  id: string;
  amountCents: number;
  status: string;
}

export interface PaymentProvider {
  createQuotePaymentLink(input: {
    quoteId: string;
    amountCents: number;
    customerName: string;
    reference: string;
  }): Promise<{ url: string; expiresAt: string }>;
  findPayments(reference: string): Promise<Payment[]>;
}
