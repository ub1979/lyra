"""The first-turn "is this already the configured provider?" question."""

from __future__ import annotations

import pytest

from tui_gateway.provider_identity import same_provider_identity

OLLAMA = "http://127.0.0.1:11434/v1"
LMSTUDIO = "http://127.0.0.1:1234/v1"


def resolver(name: str):
    return {
        "ollama-local": ("custom", OLLAMA),
        "lmstudio": ("custom", LMSTUDIO + "/"),
        "openrouter": ("openrouter", "https://openrouter.ai/api/v1"),
    }.get(name)


def test_no_preference_or_same_name_is_the_same():
    assert same_provider_identity("", "custom", OLLAMA, resolver)
    assert same_provider_identity(None, "custom", OLLAMA, resolver)
    assert same_provider_identity("ollama-local", "Ollama-Local ", OLLAMA, resolver)


def test_a_named_provider_built_as_its_class_on_the_same_endpoint_is_the_same():
    # The build path: agent.provider == "custom", endpoint from the entry.
    assert same_provider_identity("ollama-local", "custom", OLLAMA, resolver)
    assert same_provider_identity("lmstudio", "custom", LMSTUDIO, resolver), "trailing slash is not a difference"


def test_two_custom_providers_on_different_endpoints_are_different():
    assert not same_provider_identity("lmstudio", "custom", OLLAMA, resolver)


def test_a_different_class_is_different():
    assert not same_provider_identity("openrouter", "custom", OLLAMA, resolver)


@pytest.mark.parametrize("actual", ["https://example.test/API", "https://example.test/api?key=A"])
def test_endpoint_path_and_query_case_are_not_collapsed(actual):
    assert not same_provider_identity("named", "custom", actual,
                                      lambda _: ("custom", actual.lower()))


def test_endpoint_host_case_and_trailing_slash_are_equivalent():
    assert same_provider_identity("named", "custom", "https://EXAMPLE.test/api/",
                                  lambda _: ("custom", "https://example.test/api"))


@pytest.mark.parametrize("resolve", [lambda name: None, lambda name: (_ for _ in ()).throw(RuntimeError("offline"))])
def test_unresolvable_names_fall_back_to_the_name_comparison(resolve):
    assert not same_provider_identity("ollama-local", "custom", OLLAMA, resolve)
    assert same_provider_identity("custom", "custom", OLLAMA, resolve)
