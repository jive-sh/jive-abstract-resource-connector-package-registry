import { v } from "convex/values";
import { action } from "./_generated/server";

/** One package, as a package's jive block declares it. */
const instance = v.object({ packageName: v.string() });

/**
 * Makes sure the package exists and that the caller's workflow and environment may publish it by trusted
 * publishing; see PackageRegistryComponentApi in jive-abstract-resource-connector-package-registry.
 */
export const ensureInstance = action({
  args: {
    instance,
    caller: v.object({
      codeRepository: v.object({ id: v.string(), owner: v.string(), name: v.string() }),
      environment: v.string(),
      workflowFile: v.string(),
    }),
    account: v.object({ token: v.string() }),
  },
  returns: v.union(
    v.object({ status: v.literal("ready"), instanceId: v.string(), instance }),
    v.object({ status: v.literal("inProgress"), retryAfterSeconds: v.number() }),
    v.object({ status: v.literal("personNeeded"), reason: v.string(), url: v.string(), resultUrl: v.optional(v.string()) }),
    v.object({ status: v.literal("refused"), reason: v.string() }),
  ),
  handler: async (): Promise<never> => {
    throw new Error("resource.ensureInstance is not implemented yet");
  },
});
