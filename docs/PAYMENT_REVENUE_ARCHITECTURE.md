# ETHIO TRANSPORT — Payment, Ticketing & Revenue Architecture

This module is additive. Existing route, fare, report, safety, map, emergency and other working sections remain unchanged.

## Revenue streams
- Annual membership
- Bus-ticket platform commission
- Payment-provider commercial incentives/revenue share only when contractually agreed
- Advertising
- Sponsorship
- Business/API services

## Payment flow
1. Client creates a server-side transaction.
2. Server creates the order with the selected payment provider.
3. Provider checkout/native SDK is launched.
4. Provider sends a server notification.
5. Server verifies the payment before marking it paid.
6. Membership/ticket entitlement is issued only after verified payment.
7. Settlement records keep gross amount, provider fee, platform revenue and partner amount separately.

## Production secrets
Keep these only in Vercel/server environment variables:
- SUPABASE_SERVICE_ROLE_KEY
- TELEBIRR_BASE_URL
- TELEBIRR_APP_ID
- TELEBIRR_APP_SECRET
- TELEBIRR_MERCHANT_CODE
- TELEBIRR_FABRIC_APP_ID
- TELEBIRR_PRIVATE_KEY
- TELEBIRR_NOTIFY_URL
- TELEBIRR_REDIRECT_URL

Telebirr currently documents C2B H5 checkout and a production Android SDK. The production Android SDK is the preferred route for the Play Store wrapper because it can launch the Telebirr payment terminal from the native app. Production merchant credentials and product permission are required before live charging.

## Safety rule
No browser callback is treated as final payment proof. Provider-side verification is required.

## Ticket commissions
commission_rules stores contractual rates in basis points. ticket_orders.platform_commission stores the platform share per order. revenue_settlements separates partner settlement from ETHIO TRANSPORT revenue.

## Advertising
ad_campaigns supports hero, banner, card, video and sponsored-service placements. ad_payments links advertiser payments to campaigns.

## Activation
1. Register ETHIO TRANSPORT as an approved merchant.
2. Obtain production Telebirr credentials and payment-product permission.
3. Add credentials only to Vercel server environment variables.
4. Complete the native Android Telebirr SDK bridge for the Play Store build.
5. Run sandbox/test transactions and verify callbacks/reconciliation.
6. Enable production charging only after successful verification.
