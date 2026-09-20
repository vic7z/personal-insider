import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import ts from "typescript";
import assert from "node:assert/strict";
mkdirSync("work", { recursive: true });
for (const name of ["domain", "bnf"]) {
  const source = readFileSync("lib/" + name + ".ts", "utf8").replace(
    "./domain",
    "./domain-test-module.mjs",
  );
  writeFileSync(
    "work/" + name + "-test-module.mjs",
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
}
const { bnfSchema, scheduleDates, pageText } =
  await import("../work/bnf-test-module.mjs");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
for (const [file, start, end] of process.argv
  .slice(2)
  .map((f, i) => [f, i === 0 ? 8 : 15, i === 0 ? 14 : 21])) {
  const task = pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)) });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const text = pageText(
      (await page.getTextContent()).items.filter((i) => "str" in i),
    );
    assert.deepEqual(scheduleDates(text), {
      start_date: `2026-09-${String(start).padStart(2, "0")}`,
      end_date: `2026-09-${end}`,
    });
    assert.ok(
      text.includes(`${start + 2}-Sept-26: REEF TO GILL`),
      "Thursday special stays in its date column",
    );
    assert.ok(
      text.includes(`${start + 5}-Sept-26: REEF TO GILL`),
      "Sunday special stays in its date column",
    );
    for (const value of [
      "OCEAN OF FLAVOR",
      "REEF TO GILL",
      "KITCHEN",
      "325",
      "DJ OFF",
    ])
      assert.ok(text.includes(value), value);
    console.log(
      `Extraction passed: ${start}-${end} September (${text.length} characters)`,
    );
  } finally {
    await task.destroy();
  }
}
assert.deepEqual(scheduleDates("31-Feb-26"), { start_date: "", end_date: "" });
assert.equal(
  bnfSchema.safeParse({
    title: "Week",
    start_date: "2026-09-21",
    end_date: "2026-09-15",
    details: "x",
  }).success,
  false,
);
assert.equal(
  bnfSchema.safeParse({
    title: "Week",
    start_date: "2026-09-15",
    end_date: "2026-09-21",
    details: "   ",
  }).success,
  false,
);
console.log("Date and required-review validation passed");
