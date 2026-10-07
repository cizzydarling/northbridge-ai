"""Keep the CI third-party warning exception narrower than application warnings."""
import re
import shlex
import warnings
from pathlib import Path

import pytest
from _pytest.config import apply_warning_filters


MESSAGE = "'crypt' is deprecated and slated for removal in Python 3.13"


def ci_filters():
    workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/ci.yml").read_text()
    command = re.search(
        r"python -m pytest backend/tests --verbose.*?(?=\n\n)", workflow, re.S
    ).group()
    arguments = shlex.split(command)
    return [arguments[index + 1] for index, value in enumerate(arguments) if value == "-W"]


def test_cli_error_overrides_configuration_file_exception():
    with warnings.catch_warnings():
        warnings.resetwarnings()
        apply_warning_filters([ci_filters()[1]], ["error"])
        with pytest.raises(DeprecationWarning):
            warnings.warn_explicit(
                MESSAGE, DeprecationWarning, "synthetic.py", 1, module="passlib.utils"
            )


@pytest.mark.parametrize(
    "message,module,tolerated",
    [
        (MESSAGE, "passlib.utils", True),
        ("Unrelated third-party deprecation", "passlib.utils", False),
        (MESSAGE, "app.services.authentication", False),
        ("Application deprecation", "app.services.authentication", False),
    ],
)
def test_ci_warning_exception_is_scoped(message, module, tolerated):
    filters = ci_filters()
    assert filters[0] == "error"
    with warnings.catch_warnings():
        warnings.resetwarnings()
        apply_warning_filters([], filters)
        if tolerated:
            warnings.warn_explicit(message, DeprecationWarning, "synthetic.py", 1, module=module)
        else:
            with pytest.raises(DeprecationWarning):
                warnings.warn_explicit(message, DeprecationWarning, "synthetic.py", 1, module=module)
