import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProviderAddressNotice } from "./ProviderAddressNotice";

describe("provider address notice", () => {
  it("explains the safe restart boundary without changing settings", () => {
    const html = renderToStaticMarkup(<ProviderAddressNotice />);
    expect(html).toContain('role="note"');
    expect(html).toContain("finish or stop active work");
    expect(html).toContain("restart the Lyra backend");
    expect(html).toContain("Ordinary model selection does not require");
    expect(html).not.toContain("<button");
  });
});
