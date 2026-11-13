# API discovery (WP0)

Blocked. This environment has no HaloPSA, Benji Pays, D&H, or Ingram credentials, and no app secrets are stored for the project.

No live calls were made. No request or response fixtures were invented. When credentials exist, capture one scrubbed note and fixture pair per API before any adapter treats a payload field as real.

Open questions from the handoff, still open:

1. Halo auth flow, and the real `POST /Quotation` and `/Quotation/Lines` bodies.
2. Whether Halo converts a quotation to a sales order, or the sales order is posted separately.
3. Benji Pays fields for an unapplied payment link, and whether webhooks exist.
4. D&H and Ingram rate limits, and whether D&H supports keyword search or only SKU lookup.
5. What the NTS Direct API covers. Docs are not in `docs/api/nts/` yet.
