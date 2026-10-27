# ETHIO TRANSPORT

Ethiopia's public transport information and service platform.

## Product direction
ETHIO TRANSPORT is **not a ride-hailing app**. It is a public-facing transport information and service hub designed to receive, validate, organize and present official or authorized transport information.

## Working modules
- Route Finder — origin/destination workflow with map handoff.
- Fare Guard — transparent distance × verified-rate calculation; no invented official fares.
- Ticket — prepared service gateway.
- One-Tap Report — complaint/problem form with reference number, local offline fallback, and webhook integration.
- Problem Map — device location and map handoff.
- Emergency Help — authority-managed emergency contact architecture.
- Trusted Trip — local Trip Proof record.
- Accessibility — structured accessibility request.
- Parcel / Document — separated service gateway.
- Offline / Low Data — local records without fabricating live official information.

## Authority integrations
Configure these Vercel environment variables when an authorized provider endpoint is available:
- `TRANSPORT_COMPLAINT_WEBHOOK_URL`
- `TRANSPORT_TARIFFS_URL`
- `TRANSPORT_ROUTES_URL`

The app deliberately does not invent official fares, route schedules, ticket prices, authority names, or emergency numbers. Provider responses should include source organization, publication date, effective date, update timestamp and status.

## Production principle
Official information must be traceable to its responsible/authorized source. Integration endpoints should be protected server-side; never expose private API keys in `NEXT_PUBLIC_*` variables.
