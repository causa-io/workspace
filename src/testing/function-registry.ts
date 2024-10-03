import { jest } from '@jest/globals';
import { WorkspaceContext, WorkspaceFunction } from '../context/index.js';
import {
  FunctionRegistry,
  type ImplementableFunctionArguments,
  type ImplementableFunctionDefinitionConstructor,
  type ImplementableFunctionReturnType,
} from '../function-registry/index.js';

/**
 * A mock implementation of a {@link WorkspaceFunction._call} method.
 *
 * The first argument is the {@link WorkspaceContext}, while the second contains the arguments for the function.
 * (The second argument is actually the mock function instance itself.)
 */
export type WorkspaceFunctionMockImplementation<
  D extends WorkspaceFunction<any>,
> = (
  context: WorkspaceContext,
  args: ImplementableFunctionArguments<D>,
) => ImplementableFunctionReturnType<D>;

/**
 * A {@link jest.Mock} called when the corresponding mocked {@link WorkspaceFunction} is called.
 */
export type WorkspaceFunctionCallMock<D extends WorkspaceFunction<any>> =
  jest.Mock<WorkspaceFunctionMockImplementation<D>>;

/**
 * Creates a mock implementation of a {@link WorkspaceFunction} and returns the {@link jest.Mock} that can be used to
 * spy on calls to the function (and to modify the mock's implementation).
 *
 * @example
 * ```typescript
 * const { context, functionRegistry } = createContext();
 * const mock = registerMockFunction(
 *   functionRegistry,
 *   MyDefinition,
 *   (context, args) => args.firstArg === 'someValue' ? 'firstReturn' : 'secondReturn',
 * );
 *
 * expect(context.call(MyDefinition, { firstArg: 'someValue' })).toEqual('firstReturn');
 * expect(mock).toHaveBeenCalledWith(context, { firstArg: 'someValue' });
 * ```
 *
 * @param functionRegistry The {@link FunctionRegistry} in which the mock should be registered.
 * @param definition The constructor of the parent abstract definition class.
 * @param implementation A function used as the implementation for the mock / {@link WorkspaceFunction._call} method.
 * @param options Options when creating the mock function.
 * @returns The {@link jest.Mock}, called every time the {@link WorkspaceFunction} is instantiated and called.
 */
export function registerMockFunction<D extends WorkspaceFunction<any>>(
  functionRegistry: FunctionRegistry<WorkspaceContext>,
  definition: ImplementableFunctionDefinitionConstructor<D>,
  implementation: WorkspaceFunctionMockImplementation<D>,
  options: {
    /**
     * A function that implements the {@link WorkspaceFunction._supports} method for the mock.
     * Defaults to returning `true`.
     */
    supports?: (
      context: WorkspaceContext,
      args: ImplementableFunctionArguments<D>,
    ) => boolean;
  } = {},
): WorkspaceFunctionCallMock<D> {
  const mockCall = jest.fn(implementation);
  const supports = options.supports ?? (() => true);

  class MockFunction extends (definition as any) {
    _call(context: WorkspaceContext) {
      return mockCall(context, this as any);
    }

    _supports(context: WorkspaceContext): boolean {
      return supports(context, this as any);
    }
  }

  functionRegistry.registerImplementations(MockFunction);

  return mockCall;
}
