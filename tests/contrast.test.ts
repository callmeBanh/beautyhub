import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditContrast, contrastChecks } from "../scripts/check-contrast.mjs";

describe("theme contrast tokens", () => {
  const styles = readFileSync("src/styles.css", "utf8");
  const results = auditContrast(styles);

  it("meets AA for the important light, dark, and interactive pairs", () => {
    expect(results).toHaveLength(contrastChecks.length);
    expect(results.filter((result) => !result.pass)).toEqual([]);
  });
});
