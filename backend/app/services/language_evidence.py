"""Validation of user-reported benchmarks, never independent verification."""


def valid_benchmark(value):
    return value if type(value) is int and 1 <= value <= 12 else None


def reported_language_level(profile):
    """Ignore the combined legacy scalar: its language provenance is unknown."""
    values = [valid_benchmark(getattr(profile, field, None)) for field in
              ("english_language_score", "french_language_score")]
    present = [value for value in values if value is not None]
    return max(present) if present else None
