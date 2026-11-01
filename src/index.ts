/**
 * The public surface of this abstract: the contract every package-registry connector implements, for the apps
 * that call such connectors and for the build that checks them. Connector packages reach the hooks through the
 * `jive-resource-connector-package-registry` CLI.
 */
export type {
  CreatePlaceholderArgs,
  CreatePlaceholderResult,
  PackageRegistryComponentApi,
  RegisterTrustedPublisherArgs,
  RegisterTrustedPublisherResult,
  RegistryAccount,
  RemoveTrustedPublisherArgs,
  RemoveTrustedPublisherResult,
  SecondFactorRequired,
  TrustedPublisher,
  TrustedPublisherClaims,
} from "./internal/public/contract";
export { packageRegistryAbstract } from "./internal/public/package-registry";
export { packageRegistryScaffold } from "./internal/public/scaffold";
