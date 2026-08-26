# NorthBridgeAI support playbook

## Service promise

NorthBridgeAI helps people organize immigration information, documents, and next steps. It does not provide legal advice, make immigration decisions, or guarantee eligibility, invitations, processing times, or outcomes.

## First-response targets

- Account access, billing, and privacy requests: acknowledge within one business day.
- Broken core workflow or missing paid access: acknowledge within four business hours during the soft release.
- Security or possible document-access issue: escalate immediately to the release owner; do not ask the customer to send sensitive documents by email.

## Approved response patterns

### Account access

Confirm the email address associated with the account without asking for a password. Direct the customer to the password-reset flow. If they do not receive the email, check delivery logs and advise them to inspect spam/junk folders before retrying.

### Billing and plan access

Ask for the email associated with the account and the approximate payment time. Verify the Stripe event and internal billing record before changing access. Do not request or accept card numbers, banking information, or payment screenshots containing sensitive data.

### Document privacy or access

Thank the customer, collect only the minimum details needed to identify the account and document, and escalate immediately. Preserve request IDs and timestamps. Do not request copies of passports, immigration forms, financial evidence, or other sensitive documents through regular email.

### Immigration questions

Provide general, source-based information and link to the relevant official IRCC page where appropriate. State clearly that NorthBridgeAI is informational and is not legal advice. For case-specific legal, admissibility, asylum, enforcement, or urgent status questions, recommend an authorized Canadian immigration professional.

## Escalation triggers

Escalate to the release owner immediately for:

- A user seeing another person's information or document.
- Duplicate charges, paid access not granted, or a disputed charge.
- A suspected account compromise or unexpected password-reset activity.
- Incorrect immigration content that could materially affect a user's decision.
- A broken disclosure, consent, or account-deletion flow.

## Launch log fields

Record date/time, account email or internal identifier, issue type, severity, request ID, owner, actions taken, customer-facing resolution, and whether a product or content follow-up is required.
