# ETHIO TRANSPORT — Authority Fare Workflow

## Purpose

Transport authorities can send current, official tariff data directly into ETHIO TRANSPORT. The public app reads only submissions that have passed the reviewer workflow and have status `published`.

The Ministry of Transport and Logistics publicly lists Addis Ababa and regional transport offices, supporting the need for a coordinated federal/regional transport information workflow.

## Workflow

Authority account -> Submit -> Reviewer -> Approve -> Publish -> Public fare search

A published submission is immediately available through the public fare-search API. The app does not invent, interpolate, or expose a draft tariff.

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

Reviewer/admin accounts use:

```json
{ "role": "reviewer" }
```

or:

```json
{ "role": "admin" }
```

## Portals

Authority submission portal: `/authority`

Reviewer console: `/review/authority-fares`

The portal uses Supabase email/password authentication. Database RLS independently enforces authority ownership, assigned region, reviewer permissions, and public visibility.

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
- review and publication timestamps

## Public integrity rule

Only `published` authority submissions whose effective date window contains the current time are eligible for public fare search.

Authority-published records are ranked ahead of older database fare rows for the same service/distance match.

## Official source context

The Ministry of Transport and Logistics regional-office directory lists Addis Ababa and regional transport offices. The Addis Ababa City Administration Transport Bureau also publishes transport resources and public contact/location information.

This implementation creates the technical channel; it does not claim that any authority has agreed to participate until that authority is formally onboarded and its account is provisioned.
