import { describe, it, expect } from "vitest";
import {
  bestProviderForQuery,
  queryMatchesProviderOnly,
} from "./model-picker-filter";

describe("bestProviderForQuery", () => {
  it("selects local Ollama instead of leaving Anthropic hidden-selected", () => {
    const providers = [
      { name: "Ollama — this computer", slug: "ollama-local" },
      { name: "Ollama Cloud", slug: "ollama-cloud" },
      { name: "Anthropic", slug: "anthropic" },
    ];

    expect(bestProviderForQuery(providers, "oll")?.slug).toBe("ollama-local");
  });

  it("falls back to the fuzzy-ranked first provider for a model-name query", () => {
    const providers = [
      { name: "OpenAI Codex", slug: "openai-codex" },
      { name: "Anthropic", slug: "anthropic" },
    ];

    expect(bestProviderForQuery(providers, "gpt-5.4")?.slug).toBe(
      "openai-codex",
    );
  });
});

describe("queryMatchesProviderOnly", () => {
  it("returns true when the query finds the provider but no model id (issue #65374)", () => {
    // Reproduces the exact case from the issue: typing "aws" locates the
    // "AWS Build" provider, but none of its Claude model ids contain "aws".
    const provider = { name: "AWS Build", slug: "aws-build" };
    const models = ["claude-sonnet-4.5", "claude-sonnet-4", "claude-haiku-4.5"];

    expect(queryMatchesProviderOnly(provider, models, "aws")).toBe(true);
  });

  it("returns false when the query also matches a model id — keeps normal filtering", () => {
    const provider = { name: "AWS Build", slug: "aws-build" };
    const models = ["claude-sonnet-4.5", "claude-sonnet-4", "claude-haiku-4.5"];

    expect(queryMatchesProviderOnly(provider, models, "sonnet")).toBe(false);
  });

  it("returns false when the query does not match the provider at all", () => {
    const provider = { name: "AWS Build", slug: "aws-build" };
    const models = ["claude-sonnet-4.5"];

    expect(queryMatchesProviderOnly(provider, models, "openrouter")).toBe(false);
  });

  it("returns false for an empty query", () => {
    const provider = { name: "AWS Build", slug: "aws-build" };
    const models = ["claude-sonnet-4.5"];

    expect(queryMatchesProviderOnly(provider, models, "")).toBe(false);
  });

  it("returns false when there is no selected provider", () => {
    expect(queryMatchesProviderOnly(null, ["claude-sonnet-4.5"], "aws")).toBe(false);
  });
});
