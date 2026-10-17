# Rules foundation: release contract

The registry contains metadata only. No production rules, numerical thresholds,
CRS engines, eligibility routes or administration endpoints are activated.
Synthetic fixtures are test-only, never candidate immigration rules.

Workflow: detected official change → UNDER_REVIEW candidate → human source and
applicability review → immutable version/supersession → independent fixtures →
hosted regression tests → explicit release approval → separately authorized rollout.
AI may explain a diff; it cannot approve rules or change activation.

Source verification must record the exact official clause/table and effective
dates. Missing/unavailable sources remain unverified. `effective_to` is exclusive.
Conflicting applicable versions fail closed even when one is verified. Historical
SUPERSEDED rules require explicit historical selection. Previous intervals must
close before supersession. An approved manifest is bound to its SHA-256 digest.

`ReleaseApproval` and reviewer allowlists are trusted offline release inputs,
not user claims or HTTP authorization. There is intentionally no activation API.
Any future API must authenticate and authorize reviewers independently and persist
approval evidence; never accept reviewer identity from a request body as authority.
Selection requires an explicit date, program, jurisdiction and applicability.
Historical replay selects the effective rules for the requested date using the
explicitly approved release bundle; it does not claim approval existed on that
historical date. Rule review dates must not
postdate release approval. No selection falls back to old rules for current use.

Extension scopes can cover CRS, language equivalencies, federal criteria and later
PNP/Québec. Adding a scope does not make it supported. Future announced changes
need distinct effective versions and review; current containment stays in force.
