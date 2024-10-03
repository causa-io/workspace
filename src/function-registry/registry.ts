import { plainToInstance } from 'class-transformer';
import { ValidationError, parseObject } from '../validation/index.js';
import {
  ImplementableFunction,
  type ImplementableFunctionArguments,
  type ImplementableFunctionDefinitionConstructor,
  type ImplementableFunctionImplementationConstructor,
  type ImplementableFunctionReturnType,
} from './definition.js';
import {
  FunctionDefinitionDoesNotMatchError,
  InvalidFunctionArgumentError,
  InvalidFunctionError,
  NoImplementationFoundError,
  TooManyImplementationsError,
} from './errors.js';

/**
 * Holds the full definition of a function and all its known implementations.
 */
type RegisteredFunction<
  C extends object,
  D extends ImplementableFunction<C, any>,
> = {
  /**
   * The constructor of the abstract class defining the function.
   */
  definition: ImplementableFunctionDefinitionConstructor<D>;

  /**
   * The list of constructors of concrete types inheriting from the definition.
   */
  implementations: ImplementableFunctionImplementationConstructor<D>[];
};

/**
 * A registry keeping a reference to all available implementations of each {@link ImplementableFunction}.
 * Implementations can be added using the `register*` methods, and can be invoked using the `call` method.
 *
 * @example
 * ```typescript
 * abstract class MyDefinition extends ImplementableFunction<any, string> {
 *   name!: string;
 * }
 *
 * class MyImplementation extends MyDefinition {
 *   _call(): string {
 *     return `👋 ${this.name}!`;
 *   }
 *
 *   _supports(): boolean {
 *     return true;
 *   }
 * }
 *
 * const registry = new FunctionRegistry<any>();
 * registry.registerImplementations(MyImplementation);
 * registry.call(MyDefinition, { arg: 'Bob' }, {}); // '👋 Bob!'
 * ```
 */
export class FunctionRegistry<C extends object> {
  /**
   * A map where keys are function names and values contain the definition and implementations for the function.
   * Function names are the name of the classes defining the functions.
   */
  private readonly functions: Record<string, RegisteredFunction<C, any>> = {};

  /**
   * Creates a new {@link FunctionRegistry}.
   *
   * @param baseDefinitionClass The class from which all definitions should inherit.
   *   This is used when looking for the definition of an implementation for example.
   *   By default, this is {@link ImplementableFunction}.
   */
  constructor(
    private readonly baseDefinitionClass: ImplementableFunctionDefinitionConstructor<
      ImplementableFunction<C, any>
    > = ImplementableFunction,
  ) {}

  /**
   * Registers a new implementation of a function.
   *
   * @param definition The constructor of the abstract class defining the function.
   * @param implementation A concrete implementation of the function (a child of the abstract class).
   */
  register<D extends ImplementableFunction<C, any>, I extends D>(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    implementation: ImplementableFunctionImplementationConstructor<I>,
  ) {
    this.getMatchingRegisteredFunction(definition, {
      create: true,
    }).implementations.push(implementation);
  }

  /**
   * Registers several function implementations, possibly of different functions.
   * Implementation constructors must be direct children of the base function definition.
   *
   * @param implementations The list of implementations to register.
   */
  registerImplementations(
    ...implementations: ImplementableFunctionImplementationConstructor<
      ImplementableFunction<C, any>
    >[]
  ) {
    implementations.forEach((implementation) =>
      this.register(
        this.getDefinitionForImplementation(implementation),
        implementation,
      ),
    );
  }

  /**
   * Returns the definition of the given function implementation.
   * This finds the direct child class of {@link FunctionRegistry.baseDefinitionClass}, which must be inherited by all
   * definitions. By default, this is {@link ImplementableFunction}.
   * A definition class might also be an implementation if there is a single one. However most commonly the definition
   * will be subclassed to provide an implementation.
   *
   * @param implementation The implementation for which the definition should be found.
   * @returns The class constructor of the definition class.
   */
  getDefinitionForImplementation<D extends ImplementableFunction<C, any>>(
    implementation: ImplementableFunctionImplementationConstructor<D>,
  ): ImplementableFunctionDefinitionConstructor<D> {
    const parentClass = Object.getPrototypeOf(implementation);
    if (parentClass === this.baseDefinitionClass) {
      return implementation;
    }

    if (parentClass === null) {
      throw new InvalidFunctionError(
        'Implementation is not a child of the WorkspaceFunction class.',
      );
    }

    return this.getDefinitionForImplementation(parentClass);
  }

  /**
   * Returns the list of all known definitions (for which at least one implementation exists).
   *
   * @returns The list of definitions.
   */
  getDefinitions(): ImplementableFunctionDefinitionConstructor<
    ImplementableFunction<C, any>
  >[] {
    return Object.values(this.functions).map(({ definition }) => definition);
  }

  /**
   * Finds the implementation of a given function that supports the given context.
   *
   * @param definition The constructor of the abstract class defining the function, or its name.
   * @param args Arguments to pass to the function.
   * @param context The context in which the function will be run.
   * @returns The implementation supporting execution in the given context.
   */
  getImplementation<D extends ImplementableFunction<C, any>>(
    definition: string | ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
    context: C,
  ): D {
    const implementations = this.getImplementations(definition, args, context);

    if (implementations.length === 0) {
      throw new NoImplementationFoundError(definition);
    }

    if (implementations.length > 1) {
      throw new TooManyImplementationsError(definition);
    }

    return implementations[0];
  }

  /**
   * Finds the implementations of a given function that supports the given context.
   *
   * @param definition The constructor of the abstract class defining the function, or its name.
   * @param args Arguments to pass to the function.
   * @param context The context in which the function will be run.
   * @returns The implementations supporting execution in the given context.
   */
  getImplementations<D extends ImplementableFunction<C, any>>(
    definition: string | ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
    context: C,
  ): D[] {
    const registeredFunction =
      typeof definition === 'string'
        ? this.getRegisteredFunctionByName(definition)
        : this.getMatchingRegisteredFunction(definition);
    return (registeredFunction?.implementations ?? [])
      .map((ctor) => plainToInstance(ctor, args))
      .filter((implementation) => implementation._supports(context));
  }

  /**
   * Invokes the appropriate implementation of the given function definition.
   *
   * @param definition The constructor of the abstract class defining the function.
   * @param args Arguments to pass to the function.
   * @param context The context in which the function is run.
   * @returns The result of the function call.
   */
  call<D extends ImplementableFunction<C, any>>(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
    context: C,
  ): ImplementableFunctionReturnType<D> {
    const implementation = this.getImplementation(definition, args, context);
    return implementation._call(context);
  }

  /**
   * Validates the arguments for the given function definition.
   * If the arguments are invalid, an {@link InvalidFunctionArgumentError} is thrown.
   * The constructor for the function definition is returned, which can be useful if the definition is referenced using
   * its name (as a simple string).
   *
   * @param definition The constructor of the abstract class defining the function, or its name.
   * @param args The arguments to validate.
   * @returns The function definition.
   */
  async validateArguments<D extends ImplementableFunction<C, any>>(
    definition: string | ImplementableFunctionDefinitionConstructor<D>,
    args: ImplementableFunctionArguments<D>,
  ): Promise<ImplementableFunctionDefinitionConstructor<D>> {
    const registeredFunction =
      typeof definition === 'string'
        ? this.getRegisteredFunctionByName(definition)
        : this.getMatchingRegisteredFunction(definition);
    if (!registeredFunction) {
      throw new NoImplementationFoundError(definition);
    }

    try {
      const { definition } = registeredFunction;
      await parseObject(definition as any, args);
      return definition;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new InvalidFunctionArgumentError(
          `Error(s) when validating arguments: ${error.validationMessages
            .map((m) => `'${m}'`)
            .join(', ')}.`,
        );
      }

      throw error;
    }
  }

  private getMatchingRegisteredFunction<
    D extends ImplementableFunction<C, any>,
  >(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    options?: { create?: false },
  ): RegisteredFunction<C, D> | undefined;

  private getMatchingRegisteredFunction<
    D extends ImplementableFunction<C, any>,
  >(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    options: { create: true },
  ): RegisteredFunction<C, D>;

  /**
   * Gets (or optionally creates) the {@link RegisteredFunction} for a given definition.
   *
   * @param definition The constructor of the abstract class defining the function.
   * @param options Options when fetching the registered function.
   * @returns The {@link RegisteredFunction}, or `undefined` if it could not be found.
   */
  private getMatchingRegisteredFunction<
    D extends ImplementableFunction<C, any>,
  >(
    definition: ImplementableFunctionDefinitionConstructor<D>,
    options: {
      /**
       * If `true`, the {@link RegisteredFunction} will be created with an empty array of implementations and returned
       * if it does not exist.
       */
      create?: boolean;
    } = {},
  ): RegisteredFunction<C, D> | undefined {
    const functionName = definition.name;

    const registeredFunction = this.functions[functionName];
    if (!registeredFunction) {
      if (options.create) {
        return (this.functions[definition.name] = {
          definition,
          implementations: [],
        });
      }

      return undefined;
    }

    if (registeredFunction.definition !== definition) {
      throw new FunctionDefinitionDoesNotMatchError(
        definition,
        registeredFunction.definition,
      );
    }

    return registeredFunction;
  }

  /**
   * Looks up a {@link RegisteredFunction} by the name of its class / constructor.
   *
   * @param definitionName The name of the definition to find.
   * @returns The {@link RegisteredFunction}, or `undefined` if it does not exist.
   */
  private getRegisteredFunctionByName(
    definitionName: string,
  ): RegisteredFunction<C, any> | undefined {
    return this.functions[definitionName];
  }
}
