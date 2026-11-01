# jive-abstract-resource-connector-package-registry

A Jive abstract for **package-registry connectors**: connectors to npm, GitHub Packages, JSR and the like. It
extends [`jive-abstract-resource-connector`](https://github.com/jive-sh/jive-abstract-resource-connector), which makes a connector a resource (a
Convex component published to npm, through [`jive-abstract-resource`](https://github.com/jive-sh/jive-abstract-resource)), and adds the contract every registry connector implements, so an app such as
`@jive-sh/server` calls any registry the same way. Its CLI is `jive-resource-connector-package-registry`.

This package was `jive-abstract-connector-package-registry` until 0.4.0; the contract is unchanged from that release.

## The contract

A connector of this kind exposes six actions. The exported type `PackageRegistryComponentApi` is the contract.

**The standard call, `resource.ensureInstance`** (`src/component/resource.ts`), is the one every resource kind
has (jive-abstract-resource). It makes sure one package exists and that the caller's workflow and environment may
publish it by trusted publishing:

| Function | Arguments | Returns |
| --- | --- | --- |
| `resource.ensureInstance` | `{ instance: { packageName }, caller, account }` | `EnsureInstanceResult<{ packageName }>`: `ready` (with `instanceId`), `inProgress`, `personNeeded` (`url` is the registry's security-key page), or `refused` |

- `caller` is a `ResourceCaller`: the code repository (`{ id, owner, name }`), environment and workflow file of the
  deploy job asking.
- `account` is the organization's account on the registry.
- The connector records the package in its own tables, bound to the code repository that first provisioned it.
- `@jive-sh/server`'s `resources:provision` calls it for kind `connector-package-registry`.

**Five registry operations in the module `packageRegistry`** (`src/component/packageRegistry.ts`) are what
`ensureInstance` is built from. They cover the first two of the three steps by which Jive provisions a new
package:

1. `createPlaceholder` creates the package by publishing an empty version as a person's account.
2. `registerTrustedPublisher` lets the package's CI workflow (`pipeline.yml` in its repository) publish it.
3. CI publishes every real version with its OIDC identity.

npm expires a trusted-publisher configuration whose first publish hasn't happened within 2 days; the expired one
stays listed but "can no longer be used or edited", and the remedy is to delete it and create a new one
([npm docs](https://docs.npmjs.com/trusted-publishers#trusted-publisher-configuration-expiry)). So a caller
registers the publisher only when that workflow is about to run, and replaces one that never published with
`removeTrustedPublisher` and `registerTrustedPublisher`.

| Function | Arguments | Returns |
| --- | --- | --- |
| `packageExists` | `{ packageName }` | `boolean` |
| `createPlaceholder` | `{ packageName, account }` | `{ status: "created", version }` \| `{ status: "alreadyExists" }` \| `{ status: "maintainedByAnotherAccount" }` \| `secondFactorRequired` |
| `listTrustedPublishers` | `{ packageName, account }` | `Array<{ id, claims, status: "validated" \| "unvalidated" }>` |
| `registerTrustedPublisher` | `{ packageName, publisher, account }` | `{ status: "registered" }` \| `{ status: "alreadyRegistered", id }` \| `secondFactorRequired` |
| `removeTrustedPublisher` | `{ packageName, id, account }` | `{ status: "removed" }` \| `{ status: "notFound" }` \| `secondFactorRequired` |

- A **trusted publisher** lets one CI workflow publish the package with its OIDC identity instead of a token.
  `publisher` (and each listed publisher's `claims`) is `{ provider: "github", repository: { owner, name },
  workflowFile, environment? }`, e.g. `{ provider: "github", repository: { owner: "jive-sh", name: "skill-sync" },
  workflowFile: "pipeline.yml", environment: "latest" }`.
- A listed publisher is **`validated`** once a version of the package was published through it, after which it
  never expires, and **`unvalidated`** otherwise. An unvalidated publisher is either waiting for its first
  publish or expired; the registry does not say which, and the caller that registered it knows when it did.
- **`account`** is `{ token }`: one person's own account on the registry, `token` from that person's login. A
  connector stores no credentials; whoever calls it passes the account to act as on every call, so one installed
  connector serves every person's account, and where credentials are kept is the caller's decision.
- **The second factor is the account's security key, not a password the call carries.** When the registry guards a
  write, the write answers `{ status: "secondFactorRequired", pageUrl, resultUrl }` and `ensureInstance` answers
  `personNeeded` with that page as `url`. `pageUrl` is the page the registry returned for using a key already on
  the account. OpenSK answers that prompt. No argument is a one-time password, and the connector does not send
  one. Adding the key is part of instantiating the connection and is the registry's own website, not this
  `pageUrl`. `resultUrl` is the registry's own done address; this contract does not poll it.
- **`createPlaceholder`** never touches an existing package. It answers `alreadyExists` only when `account`
  maintains the package, and `maintainedByAnotherAccount` when it doesn't, so a caller never goes on to
  register a publisher on someone else's package.
- Every write is idempotent: an existing package is `alreadyExists`, a publisher with the same claims
  `alreadyRegistered` (whatever its status), a publisher already deleted `notFound`.

```ts
// An app calling whichever registry connector it installed as `registry`
import type { PackageRegistryComponentApi, RegistryAccount } from "jive-abstract-resource-connector-package-registry";

async function allowPipelineToPublish(ctx: ActionCtx, registry: PackageRegistryComponentApi, account: RegistryAccount) {
  return await ctx.runAction(registry.packageRegistry.registerTrustedPublisher, {
    packageName: "jive-abstract-resource-connector",
    publisher: { provider: "github", repository: { owner: "jive-sh", name: "jive-abstract-resource-connector" }, workflowFile: "pipeline.yml", environment: "latest" },
    account,
  });
}
```

## Create a registry connector

```sh
bunx jive-resource-connector-package-registry create jive-resource-connector-package-registry-example
```

The scaffold declares all five functions with validators that match the contract and handlers that throw
"not implemented", so it builds from the start. Everything else (layout, `codegen`, the hooks, environment
variables) is `jive-abstract-resource`'s; see its README.

## What this abstract adds to the hooks

`build` compiles a check that the component's generated `ComponentApi` has every contract function with exactly
the contract's kind, arguments and return type, and fails naming each one that is missing or differs:

```text
error TS2322: Type 'true' is not assignable to type '"packageRegistry.packageExists is missing"'.
```

A connector may expose more functions than the contract's. The contract is a type only: a connector depends on
this package as a dev dependency, and nothing of it ships in an installing app.

## Decisions

- **Connector packages are unscoped** (Alex, 2026-10-26), e.g. `jive-resource-connector-package-registry-npm`.
- **Second factor.** On 2026-10-26 Alex chose to hold the account's authenticator (TOTP) secret in Jive ("for
  blocker 1, option a, we'll hold the totp secret in jive"), so in contract 0.3.0 (as
  `jive-abstract-connector-package-registry`) an account was `{ token, secondFactor: { type: "totp", secret } }`, and
  the npm connector answered with the current RFC 6238 code. Since contract 0.4.0, unchanged here in 0.1.0, an
  account is `{ token }` and a person answers the second factor on the registry's own page (`secondFactorRequired`).
  `@jive-sh/server` refuses a provisioning that meets one, naming the page, until something passes the answer
  back; `@jive-sh/cloud-sk` is the work toward that.

## Working on the test fixture

`test/fixture` depends on this package as `file:../..`, so each local fixture install copies the previous install's
`node_modules` into itself until `find`, `git status` and installs hang. Run
`rm -rf test/fixture/node_modules` before installing, and use `git status -uno` inside the fixture.

## Open questions

- GitHub Actions is the only trusted-publisher provider.
- `packageExists` takes no account, so it sees public packages only.
- Deprecating the `0.0.0` placeholder once a package's first CI release lands is not built.
