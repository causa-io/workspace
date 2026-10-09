/**
 * Checks whether a property of an instance is a method or an accessor that cannot be set, defined in the prototype
 * chain. Such properties should not be overwritten by function arguments.
 *
 * @param instance The instance in which the property would be set.
 * @param key The name of the property.
 * @returns `true` if the property should not be overwritten.
 */
function isMethodOrReadOnlyProperty(instance: object, key: string): boolean {
  if (Object.hasOwn(instance, key)) {
    return false;
  }

  for (
    let prototype = Object.getPrototypeOf(instance);
    prototype !== null;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
    if (!descriptor) {
      continue;
    }

    return 'value' in descriptor
      ? typeof descriptor.value === 'function' || !descriptor.writable
      : !descriptor.set;
  }

  return false;
}

/**
 * Creates an instance of the given class and assigns the arguments to it, without copying or transforming their
 * values.
 * Similarly to `class-transformer`, the `__proto__` and `constructor` keys are ignored, and methods and read-only
 * properties of the class are not overwritten.
 *
 * @param constructor The constructor of the class to instantiate.
 * @param args The arguments to assign to the instance.
 * @returns The created instance.
 */
export function assignArguments<T extends object>(
  constructor: new () => T,
  args: object,
): T {
  const instance = new constructor();

  for (const [key, value] of Object.entries(args)) {
    if (
      key === '__proto__' ||
      key === 'constructor' ||
      isMethodOrReadOnlyProperty(instance, key)
    ) {
      continue;
    }

    (instance as any)[key] = value;
  }

  return instance;
}
