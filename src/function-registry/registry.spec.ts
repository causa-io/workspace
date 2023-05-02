import { IsEmail } from 'class-validator';
import 'jest-extended';
import { ImplementableFunction } from './definition.js';
import {
  FunctionDefinitionDoesNotMatchError,
  InvalidFunctionArgumentError,
  InvalidFunctionError,
  NoImplementationFoundError,
  TooManyImplementationsError,
} from './errors.js';
import { FunctionRegistry } from './registry.js';

abstract class MyDef extends ImplementableFunction<any, string> {
  @IsEmail()
  arg!: string;
}
const MyDefDup = MyDef;

class MyImpl1 extends MyDef {
  _call(): string {
    return '1️⃣';
  }

  _supports(): boolean {
    return true;
  }
}

class MyImpl2 extends MyDef {
  _call(): string {
    return '️2️⃣';
  }

  _supports(): boolean {
    return true;
  }
}

abstract class MyDef2 extends ImplementableFunction<any, number> {
  otherArg!: string;
}

class MyImpl3 extends MyDef2 {
  _call(): number {
    return 1;
  }
  _supports(): boolean {
    return true;
  }
}

describe('FunctionRegistry', () => {
  let registry: FunctionRegistry<any>;

  beforeEach(() => {
    registry = new FunctionRegistry();
  });

  describe('register', () => {
    it('should register two implementations of the same definition', () => {
      registry.register(MyDef, MyImpl1);
      registry.register(MyDef, MyImpl2);

      const actualImplementations = registry.getImplementations(
        MyDef,
        { arg: '⛅' },
        {},
      );
      expect(actualImplementations).toHaveLength(2);
      expect(actualImplementations).toSatisfy((implementations: MyDef[]) =>
        implementations.some((i) => i instanceof MyImpl1),
      );
      expect(actualImplementations).toSatisfy((implementations: MyDef[]) =>
        implementations.some((i) => i instanceof MyImpl2),
      );
    });

    it('should throw when a definition with the same name does not match an existing one', () => {
      abstract class MyDef extends ImplementableFunction<any, number> {}
      class OtherImpl extends MyDef {
        _call(): number {
          return 1;
        }
        _supports(): boolean {
          return true;
        }
      }
      registry.register(MyDefDup, MyImpl1);

      expect(() => registry.register(MyDef, OtherImpl)).toThrow(
        FunctionDefinitionDoesNotMatchError,
      );
    });
  });

  describe('registerImplementations', () => {
    it('should register implementations of different definitions', () => {
      registry.registerImplementations(MyImpl1, MyImpl3);

      const actualImpl1 = registry.getImplementation(MyDef, { arg: '🤷' }, {});
      const actualImpl3 = registry.getImplementation(
        MyDef2,
        { otherArg: '👯' },
        {},
      );
      expect(actualImpl1).toBeInstanceOf(MyImpl1);
      expect(actualImpl3).toBeInstanceOf(MyImpl3);
    });
  });

  describe('getDefinitionForImplementation', () => {
    it('should return the definition class for an implementation', () => {
      const actualDef = registry.getDefinitionForImplementation(MyImpl1);

      expect(actualDef).toBe(MyDef);
    });

    it('should throw an error if the class does not implement a definition', () => {
      class Nope {
        _call(): any {}
        _supports(): any {}
      }

      expect(() => registry.getDefinitionForImplementation(Nope)).toThrow(
        InvalidFunctionError,
      );
    });
  });

  describe('getDefinitions', () => {
    it('should return all registered definitions', () => {
      registry.registerImplementations(MyImpl1, MyImpl3);

      const actualDefinitions = registry.getDefinitions();

      expect(actualDefinitions).toContain(MyDef);
      expect(actualDefinitions).toContain(MyDef2);
    });
  });

  describe('getImplementation', () => {
    it('should return the only matching implementation', () => {
      class NonMatchingImpl extends MyDef {
        _call(): string {
          return '🙈';
        }
        _supports(): boolean {
          return false;
        }
      }
      registry.registerImplementations(MyImpl1, NonMatchingImpl);

      const actualImplementation = registry.getImplementation(
        MyDef,
        { arg: 'someValue' },
        {},
      );

      expect(actualImplementation).toBeInstanceOf(MyImpl1);
      expect(actualImplementation.arg).toEqual('someValue');
    });

    it('should throw when no implementation is available', () => {
      expect(() =>
        registry.getImplementation(MyDef, { arg: '💣' }, {}),
      ).toThrow(NoImplementationFoundError);
    });

    it('should throw when more than one implementation is available', () => {
      registry.registerImplementations(MyImpl1, MyImpl2);

      expect(() =>
        registry.getImplementation(MyDef, { arg: '💣' }, {}),
      ).toThrow(TooManyImplementationsError);
    });

    it('should get an implementation by the definition name', () => {
      registry.registerImplementations(MyImpl1);

      const actualImplementation = registry.getImplementation(
        'MyDef',
        { arg: 'someValue' },
        {},
      );

      expect(actualImplementation).toBeInstanceOf(MyImpl1);
      expect((actualImplementation as any).arg).toEqual('someValue');
    });
  });

  describe('getImplementations', () => {
    it('should return an empty array', () => {
      const actualImplementations = registry.getImplementations(
        MyDef,
        { arg: '🌬️' },
        {},
      );

      expect(actualImplementations).toBeEmpty();
    });
  });

  describe('call', () => {
    it('should call the implementation', () => {
      registry.registerImplementations(MyImpl1);

      const actualResult = registry.call(MyDef, { arg: '🎉' }, {});

      expect(actualResult).toEqual('1️⃣');
    });
  });

  describe('validateArguments', () => {
    it('should validate arguments', async () => {
      registry.registerImplementations(MyImpl1);

      const actualDefinition = await registry.validateArguments(MyDef, {
        arg: 'valid@email.com',
      });

      expect(actualDefinition).toEqual(MyDef);
    });

    it('should throw when the definition has not been registered', async () => {
      const actualPromise = registry.validateArguments(MyDef, {
        arg: 'valid@email.com',
      });

      await expect(actualPromise).rejects.toThrow(NoImplementationFoundError);
    });

    it('should throw when arguments are invalid', async () => {
      registry.registerImplementations(MyImpl1);

      const actualPromise = registry.validateArguments('MyDef', {
        arg: '❌📫',
      });

      await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
    });
  });

  describe('custom base definition class', () => {
    class MyContext {
      someValue!: string;
    }

    abstract class MyBaseDefinition<R> extends ImplementableFunction<
      MyContext,
      R
    > {}

    abstract class MyContextDefinition extends MyBaseDefinition<string> {}

    class MyContextImplementation extends MyContextDefinition {
      _call(context: MyContext): string {
        return context.someValue;
      }

      _supports(context: MyContext): boolean {
        return context.someValue === '🚀';
      }
    }

    it('should return the direct child of MyBaseDefinition', () => {
      const registry = new FunctionRegistry(MyBaseDefinition);

      const actualDefinition = registry.getDefinitionForImplementation(
        MyContextImplementation,
      );

      expect(actualDefinition).toBe(MyContextDefinition);
    });
  });
});
