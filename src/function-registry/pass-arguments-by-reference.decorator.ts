/**
 * The function definitions decorated with {@link PassArgumentsByReference}.
 */
const definitionsPassingArgumentsByReference = new WeakSet<object>();

/**
 * Marks a function definition such that its arguments are passed by reference to implementations.
 *
 * By default, the function registry copies arguments into each implementation instance using `class-transformer`,
 * which applies the transformation decorators (e.g. `@Transform`) declared on the definition. Copying arguments can be
 * expensive, and does not preserve some types of values (e.g. `Map`s, `Set`s, class instances, or circular references).
 *
 * When a definition is decorated, arguments are instead assigned to implementation instances as is: only the top-level
 * object is copied, and nested values are shared between the caller and the implementations. This means:
 *
 * - `class-transformer` decorators **must not** be used in the definition, as they are not applied. Validation is also
 *   performed on the untransformed arguments.
 * - Implementations **must not** mutate their arguments, as changes would be visible to the caller and to other
 *   implementations.
 *
 * This decorator should be placed on the function definition, not on its implementations.
 *
 * @example
 * ```typescript
 * @PassArgumentsByReference()
 * export abstract class MyFunction extends WorkspaceFunction<string> {
 *   @IsObject()
 *   readonly largeObject!: Record<string, any>;
 * }
 * ```
 */
export function PassArgumentsByReference(): ClassDecorator {
  return function PassArgumentsByReferenceDecorator(definition: object) {
    definitionsPassingArgumentsByReference.add(definition);
  };
}

/**
 * Checks whether the given function definition is decorated with {@link PassArgumentsByReference}.
 *
 * @param definition The function definition.
 * @returns `true` if arguments to the function should be passed by reference.
 */
export function passesArgumentsByReference(definition: object): boolean {
  return definitionsPassingArgumentsByReference.has(definition);
}
