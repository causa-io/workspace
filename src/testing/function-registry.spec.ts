import { IsString } from 'class-validator';
import 'jest-extended';
import { WorkspaceContext, WorkspaceFunction } from '../context/index.js';
import {
  FunctionRegistry,
  NoImplementationFoundError,
} from '../function-registry/index.js';
import { createContext } from './context.js';
import { registerMockFunction } from './function-registry.js';

abstract class MyDefinition extends WorkspaceFunction<string> {
  @IsString()
  someArg!: string;
}

describe('function-registry', () => {
  let context: WorkspaceContext;
  let registry: FunctionRegistry<WorkspaceContext>;

  beforeEach(() => {
    ({ context, functionRegistry: registry } = createContext({
      configuration: { workspace: { name: '🏷️' } },
    }));
  });

  describe('registerMockFunction', () => {
    it('should register the function and return the jest mock', () => {
      const actualMock = registerMockFunction(
        registry,
        MyDefinition,
        (context, args) => `${context.get('workspace.name')} - ${args.someArg}`,
      );

      expect(context.call(MyDefinition, { someArg: '🎉' })).toEqual('🏷️ - 🎉');
      expect(actualMock).toHaveBeenCalledOnceWith(context, { someArg: '🎉' });
    });

    it('should evaluate the supports function', () => {
      registerMockFunction(registry, MyDefinition, () => '✅', {
        supports: (context, args) =>
          context.get('workspace.name') === '🏷️' && args.someArg === '🧪',
      });

      expect(context.call(MyDefinition, { someArg: '🧪' })).toEqual('✅');
      expect(() => context.call(MyDefinition, { someArg: '❌' })).toThrow(
        NoImplementationFoundError,
      );
    });
  });
});
