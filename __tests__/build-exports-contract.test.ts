import test from "ava";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();

test("tsconfig.build includes ts and tsx sources", async (t) => {
  const raw = await readFile(join(root, "tsconfig.build.json"), "utf8");
  const config = JSON.parse(raw) as { include?: string[] };
  t.truthy(config.include);
  t.true(config.include!.includes("src/**/*.ts"));
  t.true(config.include!.includes("src/**/*.tsx"));
});

test("package exports point to emitted intl-context index files", async (t) => {
  const raw = await readFile(join(root, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as {
    exports?: Record<string, { types?: string; import?: string; default?: string }>;
  };
  const intlCtx = pkg.exports?.["./intl/intl-context"];
  t.truthy(intlCtx);
  t.is(intlCtx?.types, "./dist/intl/intl-context/index.d.ts");
  t.is(intlCtx?.import, "./dist/intl/intl-context/index.js");
  t.is(intlCtx?.default, "./dist/intl/intl-context/index.js");
});
