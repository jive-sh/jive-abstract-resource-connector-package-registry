import { afterAll, describe, expect, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Runs the hooks against test/fixture, a package-registry connector made by `jive-resource-connector-package-registry
 * create` and left as scaffolded. What every connector's hooks do is jive-abstract-resource-connector's to test; this
 * checks what this abstract adds: the scaffold implements the contract, and build refuses a component that
 * doesn't. Every backend is an anonymous local one; deploy is not run, since it would publish to npm.
 */

const CLI = resolve(import.meta.dir, "../src/entrypoints/jive-resource-connector-package-registry.ts");
const FIXTURE_DIR = resolve(import.meta.dir, "fixture");
const TIMEOUT = 5 * 60 * 1000;
const scratchDirs: Array<string> = [];

function run(command: ReadonlyArray<string>, cwd: string) {
  const result = Bun.spawnSync([...command], { cwd, env: process.env, stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

function hook(script: string, cwd = FIXTURE_DIR) {
  return run(["bun", "run", script], cwd);
}

/** A copy of the fixture whose package-registry module is `source`, with its generated code regenerated to match. */
function fixtureWithModule(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "jive-resource-connector-package-registry-fixture-"));
  scratchDirs.push(dir);
  cpSync(FIXTURE_DIR, dir, {
    recursive: true,
    filter: (path) => !/[/\\](node_modules|dist|\.convex)$/.test(path) && !path.endsWith(".env.local"),
  });
  const packageJson = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  for (const [name, script] of Object.entries<string>(packageJson.scripts)) {
    packageJson.scripts[name] = script.replace("../../src/entrypoints/jive-resource-connector-package-registry.ts", CLI);
  }
  writeFileSync(join(dir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(join(dir, "src/component/packageRegistry.ts"), source);
  // The fixture's installed dependencies, this abstract included (its devDependency is file:../..).
  symlinkSync(join(FIXTURE_DIR, "node_modules"), join(dir, "node_modules"));
  const codegen = hook("codegen", dir);
  expect(codegen.exitCode, codegen.stderr).toBe(0);
  return dir;
}

const scaffolded = readFileSync(join(FIXTURE_DIR, "src/component/packageRegistry.ts"), "utf8");

afterAll(() => {
  for (const dir of scratchDirs) rmSync(dir, { recursive: true, force: true });
});

describe("the scaffold", () => {
  test("implements the contract, and the result builds and passes audit", () => {
    const build = hook("jive:cicd:build");
    expect(build.exitCode, build.stderr).toBe(0);
    expect(build.stderr).toContain("Checking the component against PackageRegistryComponentApi");
    const audit = hook("jive:cicd:audit");
    expect(audit.exitCode, audit.stderr).toBe(0);
    expect(audit.stderr).toContain("Installed component fixture.");
  }, TIMEOUT);
});

describe("build refuses a component that breaks the contract", () => {
  test("when a contract function is missing", () => {
    const dir = fixtureWithModule(scaffolded.replace("export const packageExists", "export const packageIsPublished"));
    const build = hook("jive:cicd:build", dir);
    expect(build.exitCode).not.toBe(0);
    expect(build.stdout + build.stderr).toContain("packageRegistry.packageExists is missing");
  }, TIMEOUT);

  test("when a contract function takes different arguments", () => {
    const dir = fixtureWithModule(scaffolded.replace(
      "args: { packageName: v.string() },\n  returns: v.boolean(),",
      "args: { packageName: v.string(), version: v.string() },\n  returns: v.boolean(),",
    ));
    const build = hook("jive:cicd:build", dir);
    expect(build.exitCode).not.toBe(0);
    expect(build.stdout + build.stderr).toContain("packageRegistry.packageExists does not have the contract's kind, arguments or return type");
  }, TIMEOUT);
});
