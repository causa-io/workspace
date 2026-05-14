/**
 * The constructor of an abstract class representing an {@link ImplementableFunction}.
 */
export type ImplementableFunctionDefinitionConstructor<
  T extends ImplementableFunction<any, any>,
> = abstract new () => T;

/**
 * The constructor of a concrete class implementing an {@link ImplementableFunction}.
 */
export type ImplementableFunctionImplementationConstructor<
  T extends ImplementableFunction<any, any>,
> = new () => T;

/**
 * The base class for all function definitions.
 * Function definitions should extend this class with a specific `R`.
 * However definitions should still be abstract classes and not implement the `_call` and `_supports` methods.
 *
 * Optionally, this class can be inherited once to provide a definite type for the context:
 *
 * ```typescript
 * // The base class for all definitions specific to context `MyContext`.
 * abstract class MyBaseDefinition<R> extends ImplementableFunction<MyContext, R> {}
 *
 * // A definition.
 * abstract class MyImplementableFunction extends MyBaseDefinition<string> {
 *   argument1!: string
 * }
 * ```
 */
export abstract class ImplementableFunction<C extends object, R> {
  /**
   * The context available for the execution.
   * This is set by the function registry when an instance is created, and should not be set manually.
   */
  declare readonly _context: C;

  /**
   * Runs the concrete implementation of the function.
   * Arguments are obtained from the properties of the class instance.
   *
   * @returns The result of the function's execution, as defined by the abstract function definition.
   */
  abstract _call(): R;

  /**
   * Checks whether this implementation supports the current context.
   *
   * @returns `true` If the implementation can be run against the current context.
   */
  abstract _supports(): boolean;
}

/**
 * A type defining all arguments for the given function definition.
 * The caller of a function should provide an object conforming to this type.
 */
export type ImplementableFunctionArguments<
  DefinitionType extends ImplementableFunction<any, any>,
> = Omit<DefinitionType, '_call' | '_supports' | '_context'>;

/**
 * The return type extracted from a function definition.
 * Prefer this over using generics with `T extends ImplementationFunction<C, R>`, as the TypeScript compiler will not
 * always be able to infer those.
 */
export type ImplementableFunctionReturnType<T> = T extends {
  _call(): infer R;
  _supports(): boolean;
}
  ? R
  : never;
