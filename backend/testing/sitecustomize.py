"""Carry the test socket boundary into Python migration subprocesses."""
import os
if os.environ.get("NBAI_TEST_ISOLATION") == "1":
    from isolation import install_network_guard
    install_network_guard()
