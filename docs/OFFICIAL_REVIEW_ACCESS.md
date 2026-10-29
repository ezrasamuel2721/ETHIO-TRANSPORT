# ETHIO TRANSPORT — Official Review Access

## Purpose
A separate, read-only review surface for authorized institutions. It does not replace or redesign the public ETHIO TRANSPORT service.

## Review areas
1. Public service purpose and user workflows
2. Fare and transport information
3. Routes and ticket gateways
4. Complaints and reports
5. Security and privacy
6. Technical architecture and deployment
7. Data governance and source traceability
8. Legal/institutional review evidence
9. Startup/business evaluation
10. Review evidence room

## Access model
- Public users continue using /
- Authorized reviewers use /review
- Review accounts are individual, read-only accounts
- Never give reviewers an administrator credential
- Technical/code reviewers should receive separate read-only GitHub access when appropriate
- Secrets, API keys and environment values are never exposed in the review portal

## Required Vercel environment variables
- REVIEW_ACCESS_SECRET — random secret, at least 32 characters
- REVIEW_USERS_JSON — JSON array of authorized reviewer accounts

Example shape (do not use this password in production):

[
  {
    "username": "institution-reviewer",
    "institution": "Authorized Institution",
    "role": "institution_reviewer",
    "passwordHash": "<SHA-256 password hash>",
    "expiresAt": "2027-01-31T23:59:59.000Z"
  }
]

The password is not stored in application source. Store only its SHA-256 hash in the server-side environment variable.

## Operational review standard
A reviewer should be able to verify the real service separately from supporting evidence:
- Public service behavior
- Current/verified data status
- Source organization
- Publication date
- Effective date
- Update timestamp
- Verification status
- Complaint/report reference
- Privacy policy
- Technical architecture
- Deployment and operational evidence
- Code repository and change history, when authorized

This access layer is designed to support broad institutional assessment. It does not claim automatic legal certification or guarantee that every institution will approve the product.
