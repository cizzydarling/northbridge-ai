"""Ephemeral computation reuse. Never stores authentication, ORM state or user data globally.

Contexts are reset even on failure. Returned values are detached copies so consumers
cannot mutate another consumer's result. Counters are available to tests/benchmarks;
nothing is logged or exposed by production endpoints.
"""
from contextlib import contextmanager
from contextvars import ContextVar
from copy import deepcopy
from dataclasses import dataclass, field
from functools import wraps
from time import perf_counter


@dataclass
class ComputationContext:
    values: dict = field(default_factory=dict)
    failures: dict = field(default_factory=dict)
    counts: dict = field(default_factory=dict)
    seconds: dict = field(default_factory=dict)


_current = ContextVar("strategy_computation", default=None)


@contextmanager
def computation_scope():
    existing = _current.get()
    if existing is not None:
        yield existing
        return
    context = ComputationContext()
    token = _current.set(context)
    try:
        yield context
    finally:
        _current.reset(token)
        context.values.clear()
        context.failures.clear()


def scoped_computation(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        with computation_scope():
            return function(*args, **kwargs)
    return wrapped


def reuse(namespace, key, compute, *, cache_failure=False):
    context = _current.get()
    if context is None:
        return compute()
    cache_key = (namespace, key)
    if cache_key in context.failures:
        raise context.failures[cache_key]
    if cache_key not in context.values:
        started = perf_counter()
        context.counts[namespace] = context.counts.get(namespace, 0) + 1
        try:
            context.values[cache_key] = deepcopy(compute())
        except Exception as error:
            if cache_failure:
                context.failures[cache_key] = error
            raise
        finally:
            context.seconds[namespace] = context.seconds.get(namespace, 0) + perf_counter() - started
    return deepcopy(context.values[cache_key])
