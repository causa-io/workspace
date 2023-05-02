/**
 * The base class for service cache errors.
 */
export class ServiceCacheError extends Error {}

/**
 * An error thrown when requesting a service using a constructor that has the same name as an existing service in the
 * cache, but the constructors do not match.
 */
export class ServiceDoesNotMatchCache extends ServiceCacheError {
  constructor(readonly serviceName: string) {
    super(
      `Requested service '${serviceName}' does not match the existing version in cache.`,
    );
  }
}
