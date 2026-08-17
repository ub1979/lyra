import { describe, expect, it } from "vitest";
import {
  GUIDED_SPECIALISTS_PANEL,
  guidedSpecialistModelRowClass,
} from "./guided-specialists-dialog";

const OPACITY = /\bopacity-\d+\b/g;

describe("guided specialists dialog geometry", () => {
  it("sizes the panel with a fixed height, not a content-driven max-height", () => {
    expect(GUIDED_SPECIALISTS_PANEL).toMatch(/\bh-\[88dvh\]/);
    expect(GUIDED_SPECIALISTS_PANEL).not.toMatch(/\bmax-h-\[/);
  });

  it("clamps the panel to the overlay so the header can never leave the screen", () => {
    expect(GUIDED_SPECIALISTS_PANEL).toMatch(/\bmax-h-full\b/);
  });

  it("keeps the panel a flex column that clips its own overflow", () => {
    expect(GUIDED_SPECIALISTS_PANEL).toMatch(/\bflex-col\b/);
    expect(GUIDED_SPECIALISTS_PANEL).toMatch(/\boverflow-hidden\b/);
  });

  it("gives the LLM row the same box in both states, differing only in opacity", () => {
    const on = guidedSpecialistModelRowClass(true).replace(OPACITY, "").trim();
    const off = guidedSpecialistModelRowClass(false).replace(OPACITY, "").trim();
    expect(off).toBe(on);
  });

  it("dims the row when the specialist is off without hiding it", () => {
    const off = guidedSpecialistModelRowClass(false);
    expect(off).toMatch(/\bopacity-40\b/);
    expect(off).not.toMatch(/\bhidden\b/);
    expect(guidedSpecialistModelRowClass(true)).toMatch(/\bopacity-100\b/);
  });
});
