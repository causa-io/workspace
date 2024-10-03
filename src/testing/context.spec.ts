import { pino } from 'pino';
import { ConfigurationReader } from '../configuration/reader.js';
import { type BaseConfiguration, WorkspaceFunction } from '../index.js';
import { createContext } from './context.js';

abstract class MyDefinition extends WorkspaceFunction<string> {}

class MyImplementation extends MyDefinition {
  _call(): string {
    return '🎉';
  }

  _supports(): boolean {
    return true;
  }
}

describe('context', () => {
  describe('createContext', () => {
    it('should create a context with options', () => {
      const expectedWorkingDirectory = '/some/work/dir';
      const expectedRootPath = '/some/root/path';
      const expectedProjectPath = '/some/project/path';
      const expectedLogger = pino();

      const actualTestContext = createContext({
        workingDirectory: expectedWorkingDirectory,
        rootPath: expectedRootPath,
        projectPath: expectedProjectPath,
        configuration: { workspace: { name: '💮' }, someOther: { value: 123 } },
        logger: expectedLogger,
        functions: [MyImplementation],
      });

      const actualContext = actualTestContext.context;
      expect(actualContext.logger).toBe(expectedLogger);
      expect(actualContext.workingDirectory).toEqual(expectedWorkingDirectory);
      expect(actualContext.rootPath).toEqual(expectedRootPath);
      expect(actualContext.projectPath).toEqual(expectedProjectPath);
      expect(actualContext.call(MyDefinition, {})).toEqual('🎉');
      expect(actualTestContext.configuration).toBe(
        (actualContext as any).configuration,
      );
      expect(actualTestContext.functionRegistry).toBe(
        (actualContext as any).functionRegistry,
      );
      expect(actualContext.get('someOther.value')).toEqual(123);
    });

    it('should use the passed ConfigurationReader', () => {
      const expectedConfigurationReader =
        new ConfigurationReader<BaseConfiguration>([]);

      const actualTestContext = createContext({
        configuration: expectedConfigurationReader,
      });

      expect((actualTestContext.context as any).configuration).toBe(
        expectedConfigurationReader,
      );
    });
  });
});
