import type { ScaffoldFiles, ScaffoldInput } from "jive-abstract-resource-connector";

function lines(...text: ReadonlyArray<string>): string {
  return `${text.join("\n")}\n`;
}

/**
 * `src/component/packageRegistry.ts` with every contract function declared and none implemented: the validators
 * produce exactly the types `PackageRegistryComponentApi` names, so a new connector passes the contract check
 * from its first build, and each handler fails until it is written.
 */
const PACKAGE_REGISTRY_MODULE = lines(
  `import { v } from "convex/values";`,
  `import { action } from "./_generated/server";`,
  "",
  "const claims = v.object({",
  `  provider: v.literal("github"),`,
  "  repository: v.object({ owner: v.string(), name: v.string() }),",
  "  workflowFile: v.string(),",
  "  environment: v.optional(v.string()),",
  "});",
  "",
  "/** The account an operation acts as; its caller supplies it on every call, so the component stores no credential. */",
  "const account = v.object({ token: v.string() });",
  "",
  "/** The registry wants a person to answer its second factor on `pageUrl`; the caller polls `resultUrl` and retries with `oneTimePassword`. */",
  `const secondFactorRequired = v.object({ status: v.literal("secondFactorRequired"), pageUrl: v.string(), resultUrl: v.string() });`,
  "",
  "function notImplemented(name: string): never {",
  "  throw new Error(`packageRegistry.${name} is not implemented yet`);",
  "}",
  "",
  "/** Whether the registry has any version of the package. */",
  "export const packageExists = action({",
  "  args: { packageName: v.string() },",
  "  returns: v.boolean(),",
  `  handler: async () => notImplemented("packageExists"),`,
  "});",
  "",
  "/** Creates the package by publishing an empty placeholder version as `account`; an existing package is reported, not touched. */",
  "export const createPlaceholder = action({",
  "  args: { packageName: v.string(), account, oneTimePassword: v.optional(v.string()) },",
  "  returns: v.union(",
  `    v.object({ status: v.literal("created"), version: v.string() }),`,
  `    v.object({ status: v.literal("alreadyExists") }),`,
  `    v.object({ status: v.literal("maintainedByAnotherAccount") }),`,
  "    secondFactorRequired,",
  "  ),",
  `  handler: async () => notImplemented("createPlaceholder"),`,
  "});",
  "",
  "/** The trusted publishers configured on the package, as seen by an account that maintains it. */",
  "export const listTrustedPublishers = action({",
  "  args: { packageName: v.string(), account },",
  `  returns: v.array(v.object({ id: v.string(), claims, status: v.union(v.literal("validated"), v.literal("unvalidated")) })),`,
  `  handler: async () => notImplemented("listTrustedPublishers"),`,
  "});",
  "",
  "/** Lets one CI workflow publish the package with its OIDC identity; an identical publisher is reported, not added again. */",
  "export const registerTrustedPublisher = action({",
  "  args: { packageName: v.string(), publisher: claims, account, oneTimePassword: v.optional(v.string()) },",
  "  returns: v.union(",
  `    v.object({ status: v.literal("registered") }),`,
  `    v.object({ status: v.literal("alreadyRegistered"), id: v.string() }),`,
  "    secondFactorRequired,",
  "  ),",
  `  handler: async () => notImplemented("registerTrustedPublisher"),`,
  "});",
  "",
  "/** Deletes one trusted publisher by its id; one already gone is reported as notFound. */",
  "export const removeTrustedPublisher = action({",
  "  args: { packageName: v.string(), id: v.string(), account, oneTimePassword: v.optional(v.string()) },",
  `  returns: v.union(v.object({ status: v.literal("removed") }), v.object({ status: v.literal("notFound") }), secondFactorRequired),`,
  `  handler: async () => notImplemented("removeTrustedPublisher"),`,
  "});",
);

/** A package-registry connector's starting functions: the contract's, plus an example-app action calling one. */
export function packageRegistryScaffold(input: ScaffoldInput): ScaffoldFiles {
  return {
    "src/component/packageRegistry.ts": PACKAGE_REGISTRY_MODULE,
    "example/convex/example.ts": lines(
      `import { v } from "convex/values";`,
      `import { components } from "./_generated/api";`,
      `import { action } from "./_generated/server";`,
      "",
      "export const packageExists = action({",
      "  args: { packageName: v.string() },",
      "  returns: v.boolean(),",
      `  handler: (ctx, args) => ctx.runAction(components.${input.componentName}.packageRegistry.packageExists, args),`,
      "});",
    ),
  };
}
