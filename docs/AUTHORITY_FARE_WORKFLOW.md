# ETHIO TRANSPORT — Authority Fare Workflow

## Purpose

Authorized transport authorities can publish current, official tariff data directly into ETHIO TRANSPORT. Once an authority account is formally onboarded, its tariff submission becomes public immediately after submission.

There is no reviewer, approval, or publication queue between the authorized authority and the public fare search.

## Workflow

Authority account -> Submit -> Immediate public fare search

The authority is the final official source for the tariff. The system records the authority, source/evidence details, effective dates, and audit timestamps, but does not place another human reviewer in the publication path.

## Authority accounts

Create a Supabase Auth user for each participating transport authority and set authorization metadata in `app_metadata`:

```json
{
  "role": "authority",
  "authority_name": "Addis Ababa Transport Bureau",
  "region_code": "AA",
  "region_name": "Addis Ababa"
}
```

Use `app_metadata`, not `user_metadata`, for authorization.

The authority account itself must be formally onboarded before it can publish data.

## Portal

Authority portal: `/authority`

The portal uses Supabase email/password authentication. Database RLS enforces authority ownership, assigned region, and public visibility.

## Data captured

Each submission records:

- authority and region
- service type and vehicle category
- fixed fare or ETB/km rate
- base/minimum fare
- distance band
- city/area scope
- effective dates
- official decision/document title
- official document URL
- decision/reference number
- notes
- creation/update timestamps

## Public integrity rule

Only `active` authority submissions whose effective date window contains the current time are eligible for public fare search.

Expired records are not returned as current fares.

The system never invents or interpolates a missing tariff band.

## Official source context

This implementation creates the technical channel; it does not claim that any authority has agreed to participate until that authority is formally onboarded and its account is provisioned.
