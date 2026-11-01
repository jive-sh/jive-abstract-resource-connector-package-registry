import type { FunctionReference } from "convex/server";
import type { EnsureInstanceResult, ResourceCaller } from "jive-abstract-resource";

/**
 * The functions every package-registry connector exposes, exactly as its generated `ComponentApi` must type them:
 * the standard `resource.ensureInstance` (`src/component/resource.ts`), and five registry operations in the module
 * `packageRegistry` (`src/component/packageRegistry.ts`) it is built from. An app holding
 * a registry connector, such as `@jive-sh/server`, calls them the same way whichever registry it is.
 *
 * Jive provisions a new package in three steps, the first two through this contract:
 * 1. `createPlaceholder`: the package comes into existence as an empty version published by a person's account.
 * 2. `registerTrustedPublisher`: the package's CI workflow is allowed to publish it.
 * 3. CI publishes every real version with its OIDC identity, outside this contract.
 *
 * Step 3 must follow step 2 promptly: npm expires a trusted-publisher configuration whose first publish has not
 * happened within 2 days; an expired one stays listed but "can no longer be used or edited", and the remedy is to
 * delete it and create a new one (https://docs.npmjs.com/trusted-publishers#trusted-publisher-configuration-expiry).
 * `listTrustedPublishers` says which publishers have published (`validated`) and `removeTrustedPublisher` deletes
 * one, so a caller can replace a publisher that never published.
 *
 * All six are actions, since each calls the registry over the network. Each type is written out without
 * intersections, the way Convex generates it, because the build compares the two for exact equality.
 *
 * A connector stores no credentials. A function that acts as an account is given that account's credentials by
 * its caller on every call (`account`), so one connector instance serves every person's account, and where
 * credentials live, and how they are refreshed, is the caller's decision.
 */
export type PackageRegistryComponentApi<Name extends string | undefined = string | undefined> = {
  /**
   * The standard call every resource kind has (jive-abstract-resource): make sure one package exists in the registry
   * and that the caller's workflow and environment may publish it by trusted publishing. It runs the steps below:
   * creates the placeholder if the package is missing (refusing one another account maintains), keeps a trusted
   * publisher for the caller that has published or was registered recently enough not to have expired, and
   * otherwise replaces it. The package is bound to the code repository that first provisioned it; another one is
   * refused. A write the registry guards with its second factor answers `personNeeded` with the registry's page.
   */
  resource: {
    ensureInstance: FunctionReference<"action", "internal", EnsureInstanceArgs, EnsureInstanceResult<PackageRegistryInstance>, Name>;
  };
  packageRegistry: {
    /** Whether the registry has any version of the package. */
    packageExists: FunctionReference<"action", "internal", { packageName: string }, boolean, Name>;
    /**
     * Creates the package by publishing an empty placeholder version as `account`, so it exists for
     * `registerTrustedPublisher`. A package that already exists is not touched: it is reported as `alreadyExists`
     * when `account` maintains it, and as `maintainedByAnotherAccount` when it doesn't.
     */
    createPlaceholder: FunctionReference<"action", "internal", CreatePlaceholderArgs, CreatePlaceholderResult, Name>;
    /** The trusted publishers configured on the package, as seen by an account that maintains it. The package must exist. */
    listTrustedPublishers: FunctionReference<
      "action",
      "internal",
      { packageName: string; account: RegistryAccount },
      Array<TrustedPublisher>,
      Name
    >;
    /**
     * Lets one CI workflow publish the package with its OIDC identity instead of a token. Idempotent: a publisher
     * with identical claims already configured is reported, not added again, whatever its status. The package
     * must exist.
     */
    registerTrustedPublisher: FunctionReference<
      "action",
      "internal",
      RegisterTrustedPublisherArgs,
      RegisterTrustedPublisherResult,
      Name
    >;
    /** Deletes one trusted publisher, by the id `listTrustedPublishers` reported. One already gone is `notFound`. */
    removeTrustedPublisher: FunctionReference<
      "action",
      "internal",
      RemoveTrustedPublisherArgs,
      RemoveTrustedPublisherResult,
      Name
    >;
  };
};

/**
 * A person's own account on the registry, as the credential its connector acts with: for npm, a token from that
 * person's login. How it was obtained and where it is kept are the caller's. No second factor is part of it: a
 * write the registry guards with one answers `secondFactorRequired`, and a person answers it on the registry's own
 * page (see `SecondFactorRequired`).
 */
export type RegistryAccount = {
  token: string;
};

/** One instance of a package-registry resource: a package, as a package's jive block declares it. */
export type PackageRegistryInstance = {
  packageName: string;
};

export type EnsureInstanceArgs = {
  instance: PackageRegistryInstance;
  caller: ResourceCaller;
  /** The organization's account on the registry, which creates the package and registers its publisher. */
  account: RegistryAccount;
};

/**
 * The registry wants its second factor before this write. `pageUrl` is the registry's own page where the person
 * whose account this is answers it (on npm, a page on www.npmjs.com, in that person's own browser); `resultUrl` is
 * where the caller polls for the one-time password that answer produces (on npm, a registry endpoint), which it
 * then passes back as `oneTimePassword` on the same call. The connector never answers a second factor itself.
 */
export type SecondFactorRequired = { status: "secondFactorRequired"; pageUrl: string; resultUrl: string };

export type CreatePlaceholderArgs = {
  packageName: string;
  /** The account that will own the package. */
  account: RegistryAccount;
  /** The one-time password a person's answer on `SecondFactorRequired.pageUrl` produced, when retrying. */
  oneTimePassword?: string;
};

export type CreatePlaceholderResult =
  | { status: "created"; version: string }
  | { status: "alreadyExists" }
  | { status: "maintainedByAnotherAccount" }
  | SecondFactorRequired;

export type RegisterTrustedPublisherArgs = {
  packageName: string;
  publisher: TrustedPublisherClaims;
  /** An account that maintains the package. */
  account: RegistryAccount;
  /** The one-time password a person's answer on `SecondFactorRequired.pageUrl` produced, when retrying. */
  oneTimePassword?: string;
};

export type RegisterTrustedPublisherResult =
  | { status: "registered" }
  | { status: "alreadyRegistered"; id: string }
  | SecondFactorRequired;

export type RemoveTrustedPublisherArgs = {
  packageName: string;
  /** The registry's id for the publisher, as `listTrustedPublishers` reported it. */
  id: string;
  /** An account that maintains the package. */
  account: RegistryAccount;
  /** The one-time password a person's answer on `SecondFactorRequired.pageUrl` produced, when retrying. */
  oneTimePassword?: string;
};

export type RemoveTrustedPublisherResult = { status: "removed" } | { status: "notFound" } | SecondFactorRequired;

/** Which CI workflow a trusted publisher admits. GitHub Actions is the only provider so far. */
export type TrustedPublisherClaims = {
  provider: "github";
  /** The repository the workflow runs in. */
  repository: { owner: string; name: string };
  /** The workflow's file name under `.github/workflows/`, e.g. "pipeline.yml". */
  workflowFile: string;
  /** The GitHub Actions environment the publishing job must run in, e.g. "latest"; absent admits any. */
  environment?: string;
};

export type TrustedPublisher = {
  /** The registry's id for this publisher. */
  id: string;
  claims: TrustedPublisherClaims;
  /**
   * `validated`: a version of the package was published through it, so it no longer expires. `unvalidated`: no
   * version was, so it is either waiting for its first publish or, past the registry's deadline (2 days on npm),
   * expired. The registry does not say which; a caller that registered it knows when it did.
   */
  status: "validated" | "unvalidated";
};
