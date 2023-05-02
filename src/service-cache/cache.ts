import { ServiceDoesNotMatchCache } from './errors.js';

/**
 * A constructor that service classes should implement.
 */
export type ServiceConstructor<C extends object, T extends object> = new (
  context: C,
) => T;

/**
 * A referenced to the singleton instance of a service in the cache.
 */
type CachedService = {
  /**
   * The constructor that was used to instantiate the service.
   */
  constructor: ServiceConstructor<any, any>;

  /**
   * The singleton instance of the service.
   */
  service: any;
};

/**
 * An object caching singleton instances of services.
 * The first time they are accessed, services are instantiated by calling their constructor with a context object,
 * persisted in {@link ServiceCache.context}.
 *
 * @example
 * ```typescript
 * class Service {
 *   constructor(context: any) {}
 * }
 *
 * const cache = new ServiceCache<any>({ myContext: '🔧' });
 * const service = cache.get(Service);
 * const service2 = cache.get(Service);
 * // service === service2
 * ```
 */
export class ServiceCache<C extends object> {
  /**
   * The map where keys are constructor names and values are the cached services.
   */
  private readonly cache: Record<string, CachedService> = {};

  /**
   * Creates a new {@link ServiceCache}.
   *
   * @param context The context that will be passed to services when instantiating them.
   */
  constructor(private readonly context: C) {}

  /**
   * Returns the singleton instance for a service, creating it in the process if necessary.
   *
   * @param constructor The constructor for the service.
   * @returns The singleton instance for the service.
   */
  get<T extends object>(constructor: ServiceConstructor<C, T>): T {
    const serviceName = constructor.name;

    const cachedService = this.cache[serviceName];

    if (cachedService) {
      if (cachedService.constructor !== constructor) {
        throw new ServiceDoesNotMatchCache(serviceName);
      }

      return cachedService.service;
    }

    const service = new constructor(this.context);
    this.cache[serviceName] = { constructor, service };
    return service;
  }
}
