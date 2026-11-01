import { Option } from "effect";
import type { ResourceAbstract } from "jive-abstract-resource-connector";
import { packageRegistryScaffold } from "./scaffold";

/** The package-registry kind of connector: `jive-resource-connector` with the `PackageRegistryComponentApi` contract. */
export const packageRegistryAbstract: ResourceAbstract = {
  cliName: "jive-resource-connector-package-registry",
  description: "scaffold, build, audit and publish a Jive package-registry connector: a Convex component exposing the PackageRegistryComponentApi functions",
  abstractPackageName: "jive-abstract-resource-connector-package-registry",
  contract: Option.some({ componentApiType: "PackageRegistryComponentApi" }),
  scaffold: packageRegistryScaffold,
};
