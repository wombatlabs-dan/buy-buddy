# Connecting Buy Buddy to the existing backend

## Current boundary

This first version is an interactive **Sample data** experience. It does not search marketplaces, invoke AI models, verify uploaded photographs, send messages, take payments, or bid on products. Demo hunt progress can be retained in the current browser.

The user specified an existing backend, but its base URL and API specification have not yet been supplied. Do not invent a replacement AI backend or present assumed endpoints as that backend's real contract.

The frontend keeps sample behavior behind the `BuyBuddyApi` boundary in `artifacts/buy-buddy/src/lib/types.ts`. The selected provider is exported from `src/lib/api.ts` and consumed through `src/hooks/use-hunt-data.ts`. Once the actual API is available, extend this contract to match its real responses and implement an HTTP provider, retaining the sample provider for explicitly selected demos.

The current provider contract is a frontend demonstration interface, not a claim about the existing backend's endpoints. Its challenge scenario picker and simulated verdict type are demo-only. Live integration must remove the buyer-selected outcome and use authoritative backend verdicts instead. Hunt persistence and audit events currently live in browser state; live mode must replace these with backend-owned records, not merely swap the listing-fetch function.

## Information needed for the live connection

- Backend base URL and OpenAPI specification or endpoint documentation.
- Authentication and session mechanism, including CORS requirements.
- Hunt creation response, listing identifiers, and polling or event-stream behavior.
- Going-price quote source, timestamps, currency, and any quote-expiry rules.
- Challenge generation, image-upload protocol, verification statuses, and confidence scale.
- Trust-record actor/model metadata, event identifiers, timestamps, and cost accounting.
- Original marketplace destination URLs.
- Payment ownership, if paid hunt or subscription activation is to be enabled.

Credentials must use the project's secret or integration setup, never a public frontend variable or browser storage.

## Required behavior when using live data

1. Treat the backend as the source of truth for hunt state, quoted market prices, matches, risk reasons, model names, confidence, challenge text, and verification results.
2. Validate responses at the API boundary and show explicit loading, empty, expired, and error states. A failed live request must not become a sample success.
3. Preserve seller-original titles, including misspellings. Keep discovery method and seller type as explicit structured values.
4. Display the service fee as `min(49, max(9, goingPrice * 0.02))` in USD. The budget is not the going price. Billing must quote authoritatively before any real charge.
5. For ShopGoodwill, use **condition risk** everywhere and bypass photo challenges. The buyer's affirmative decision opens the actual supplied listing URL without submitting a bid or purchase.
6. Create unique challenges on the backend. Upload photographs through the backend's supported upload flow; do not treat a successful upload as successful verification.
7. Show **Verified**, **Unverified**, or **Failed** according to the returned checks, with each reason and confidence. Use “failed verification,” not accusations about the seller.
8. Copy seller messages locally only. Ask the buyer to send them; no automatic messaging.
9. Record the actual chronological events and decisions from the backend, including actor/model, time, and cost. Keep service pricing separate from model/processing costs so the running total is not misleading.
10. Do not remove the **Sample data** banner until the entire current hunt is genuinely live. Never combine sample findings with live evidence without labeling each source.

## Not part of the first build

Backend authentication, marketplace ingestion, AI inference, real image verification, payment collection, and durable server-side photo storage require the actual backend contract and are intentionally not implemented in this frontend demo.
