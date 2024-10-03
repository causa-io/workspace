import type { ImplementableFunctionDefinitionConstructor } from './definition.js';

/**
 * The base class for function registry errors.
 */
export class FunctionRegistryError extends Error {}

/**
 * An error thrown when the function registry receives a function definition which does not match the currently
 * registered one.
 */
export class FunctionDefinitionDoesNotMatchError extends FunctionRegistryError {
  constructor(
    readonly currentDefinition: ImplementableFunctionDefinitionConstructor<any>,
    readonly existingDefinition: ImplementableFunctionDefinitionConstructor<any>,
  ) {
    super(
      `Definition for '${currentDefinition.name}' does not match the currently registered definition of the function.`,
    );
  }
}

/**
 * An error thrown when a passed class constructor is not a valid function definition or implementation.
 */
export class InvalidFunctionError extends FunctionRegistryError {}

/**
 * An error thrown when calling a function and no implementation matching the current context can be found in the
 * registered modules.
 */
export class NoImplementationFoundError extends FunctionRegistryError {
  constructor(
    readonly definition:
      | string
      | ImplementableFunctionDefinitionConstructor<any>,
  ) {
    super(
      `Could not find any implementation of function '${
        typeof definition === 'string' ? definition : definition.name
      }' supporting the context.`,
    );
  }
}

/**
 * An error thrown when calling a function and the context is not specific enough to determine which implementation
 * should be used.
 */
export class TooManyImplementationsError extends FunctionRegistryError {
  constructor(
    readonly definition:
      | string
      | ImplementableFunctionDefinitionConstructor<any>,
  ) {
    super(
      `Found more than one implementation of function '${
        typeof definition === 'string' ? definition : definition.name
      }' supporting the context.`,
    );
  }
}

/**
 * An error that can be thrown by a function implementation when an argument's value is not supported by the
 * implementation.
 */
export class InvalidFunctionArgumentError extends Error {}
