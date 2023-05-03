import { mkdtemp, rm } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import {
  ConfigurationValueNotFoundError,
  PartialConfiguration,
} from '../configuration/index.js';
import { InvalidFunctionArgumentError } from '../function-registry/index.js';
import { BaseConfiguration } from './base-configuration.js';
import { WorkspaceContext } from './context.js';
import {
  ContextNotAProjectError,
  EnvironmentNotSetError,
  InvalidSecretDefinitionError,
  ModuleNotFoundError,
  SecretBackendNotFoundError,
  SecretBackendNotSpecifiedError,
} from './errors.js';
import { MyFunction, MyFunctionImpl } from './module.test.js';
import { writeConfiguration } from './utils.test.js';

describe('WorkspaceContext', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-tests-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('configuration', () => {
    it('should expose the configuration and paths', async () => {
      const workspaceConfiguration: PartialConfiguration<BaseConfiguration> = {
        workspace: { name: 'my-workspace' },
        environments: {
          dev: { name: 'Dev', configuration: { myService: { myValue: '🎉' } } },
        },
      };
      const projectConfiguration: PartialConfiguration<BaseConfiguration> = {
        project: { name: 'my-project', type: '🐍', language: '🇫🇷' },
      };
      await writeConfiguration(tmpDir, './causa.yaml', workspaceConfiguration);
      await writeConfiguration(
        tmpDir,
        './project/causa.yaml',
        projectConfiguration,
      );
      const expectedProjectDir = join(tmpDir, 'project');

      const actualContext = await WorkspaceContext.init({
        workingDirectory: expectedProjectDir,
        environment: 'dev',
      });

      expect(actualContext.workingDirectory).toEqual(expectedProjectDir);
      expect(actualContext.rootPath).toEqual(tmpDir);
      expect(actualContext.projectPath).toEqual(expectedProjectDir);
      expect(actualContext.getProjectPathOrThrow()).toEqual(expectedProjectDir);
      expect(actualContext.getEnvironmentOrThrow()).toEqual('dev');
      expect(actualContext.get('myService.myValue')).toEqual('🎉');
      expect(() => actualContext.getOrThrow('🙅')).toThrow(
        ConfigurationValueNotFoundError,
      );
    });

    it('should throw when the project and environment are not set', async () => {
      const configuration: PartialConfiguration<BaseConfiguration> = {
        workspace: { name: 'my-workspace' },
        environments: {
          dev: { name: 'Dev', configuration: { myService: { myValue: '🎉' } } },
        },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);

      const actualContext = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      expect(() => actualContext.getProjectPathOrThrow()).toThrow(
        ContextNotAProjectError,
      );
      expect(() => actualContext.getEnvironmentOrThrow()).toThrow(
        EnvironmentNotSetError,
      );
    });
  });

  describe('clone', () => {
    it('should return a modified copy of the workspace', async () => {
      const workspaceConfiguration: PartialConfiguration<BaseConfiguration> = {
        workspace: { name: 'my-workspace' },
        environments: {
          dev: { name: 'Dev', configuration: { myService: { myValue: '🎉' } } },
        },
      };
      const projectConfiguration: PartialConfiguration<BaseConfiguration> = {
        project: { name: 'my-project', type: '🐍', language: '🇫🇷' },
      };
      await writeConfiguration(tmpDir, './causa.yaml', workspaceConfiguration);
      await writeConfiguration(
        tmpDir,
        './project/causa.yaml',
        projectConfiguration,
      );
      const expectedProjectDir = join(tmpDir, 'project');
      const baseContext = await WorkspaceContext.init({
        workingDirectory: expectedProjectDir,
      });

      const actualContext = await baseContext.clone({ environment: 'dev' });

      expect(actualContext.workingDirectory).toEqual(expectedProjectDir);
      expect(actualContext.rootPath).toEqual(tmpDir);
      expect(actualContext.projectPath).toEqual(expectedProjectDir);
      expect(actualContext.environment).toEqual('dev');
      expect(actualContext.get('myService.myValue')).toEqual('🎉');
      expect(actualContext.logger).toBe(baseContext.logger);
    });
  });

  describe('modules', () => {
    it('should load the module', async () => {
      const configuration: PartialConfiguration<BaseConfiguration> & {
        [k: string]: any;
      } = {
        workspace: { name: 'my-workspace' },
        causa: { modules: ['./module.test.ts'] },
        myFunction: { returnValue: '🎉' },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);

      const context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      const actualReturnValue = await context.callByName('MyFunction', {});
      expect(actualReturnValue).toEqual('🎉');
    });

    it('should throw when a module cannot be found', async () => {
      const configuration: PartialConfiguration<BaseConfiguration> & {
        [k: string]: any;
      } = {
        workspace: { name: 'my-workspace' },
        causa: { modules: ['./❓.ts'] },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);

      const actualPromise = WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      await expect(actualPromise).rejects.toThrow(ModuleNotFoundError);
    });
  });

  describe('functions', () => {
    beforeEach(async () => {
      const configuration: PartialConfiguration<BaseConfiguration> & {
        [k: string]: any;
      } = {
        workspace: { name: 'my-workspace' },
        causa: { modules: ['./module.test.ts'] },
        myFunction: { returnValue: '🎉' },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);
    });

    it('should call the function', async () => {
      const context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      const actualReturnValue = context.call(MyFunction, {});

      expect(actualReturnValue).toEqual('🎉');
    });

    it('should validate function arguments', async () => {
      const context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      const actualDefinition = await context.validateFunctionArguments(
        'MyFunction',
        {},
      );
      const actualPromise = context.validateFunctionArguments(MyFunction, {
        nope: '💣',
      });

      expect(actualDefinition).toBe(MyFunction);
      await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
    });

    it('should return function definitions', async () => {
      const context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      const actualDefinitions = context.getFunctionDefinitions();

      expect(actualDefinitions).toEqual([MyFunction]);
    });

    it('should return function implementations', async () => {
      const context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      const actualImplementation = context.getFunctionImplementation(
        MyFunction,
        {},
      );
      const actualImplementations = context.getFunctionImplementations(
        MyFunction,
        {},
      );

      expect(actualImplementation).toBeInstanceOf(MyFunctionImpl);
      expect(actualImplementations).toHaveLength(1);
      expect(actualImplementations[0]).toBeInstanceOf(MyFunctionImpl);
    });
  });

  describe('services', () => {
    class MyService {
      constructor(readonly context: WorkspaceContext) {}
    }

    it('should instantiate and return the service', async () => {
      const configuration: PartialConfiguration<BaseConfiguration> = {
        workspace: { name: 'my-workspace' },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);
      const context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      const actualService1 = context.service(MyService);
      const actualService2 = context.service(MyService);

      expect(actualService1).toBeInstanceOf(MyService);
      expect(actualService1).toBe(actualService2);
      expect(actualService1.context).toBe(context);
    });
  });

  describe('secrets', () => {
    let context: WorkspaceContext;

    beforeEach(async () => {
      const configuration: PartialConfiguration<BaseConfiguration> & {
        [k: string]: any;
      } = {
        workspace: { name: 'my-workspace' },
        causa: {
          modules: ['./secrets.test.ts'],
          secrets: { defaultBackend: 'default' },
        },
        secrets: {
          mySecret: { someConf: '🔑' },
          mySecretWithBackend: { backend: 'custom', otherConf: '🙏' },
          invalidDefinition: { backend: 'invalidDefinition' },
          unknownBackend: { backend: 'unknown' },
          notAnObject: '💥' as any,
        },
        otherValue: '🎉',
        someValue: {
          $format: "${ secret('mySecret') }${ configuration('otherValue') }",
        },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);
      context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });
    });

    it('should throw if the secret does not exist', async () => {
      const actualPromise = context.secret('🔍');

      await expect(actualPromise).rejects.toThrow(
        ConfigurationValueNotFoundError,
      );
    });

    it('should throw if the secret definition is invalid', async () => {
      const actualPromise = context.secret('notAnObject');

      await expect(actualPromise).rejects.toThrow(InvalidSecretDefinitionError);
    });

    it('should fetch the secret using the default backend', async () => {
      const actualSecret = await context.secret('mySecret');

      expect(JSON.parse(actualSecret)).toEqual({
        backend: 'default',
        configuration: { someConf: '🔑' },
      });
    });

    it('should fetch the secret using the specified backend', async () => {
      const actualSecret = await context.secret('mySecretWithBackend');

      expect(JSON.parse(actualSecret)).toEqual({
        backend: 'custom',
        configuration: { otherConf: '🙏' },
      });
    });

    it('should rethrow the error when a secret definition is invalid', async () => {
      const actualPromise = context.secret('invalidDefinition');

      await expect(actualPromise).rejects.toThrowError(
        InvalidSecretDefinitionError,
      );
      await expect(actualPromise).rejects.toMatchObject({
        secretId: 'invalidDefinition',
      });
    });

    it('should throw when no implementation exists for the backend', async () => {
      const actualPromise = context.secret('unknownBackend');

      await expect(actualPromise).rejects.toThrowError(
        SecretBackendNotFoundError,
      );
    });

    it('should throw when the backend is not specified', async () => {
      const configuration: PartialConfiguration<BaseConfiguration> & {
        [k: string]: any;
      } = {
        workspace: { name: 'my-workspace' },
        causa: { modules: ['./secrets.test.ts'] },
        secrets: { mySecret: { someConf: '🔑' } },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);
      context = await WorkspaceContext.init({
        workingDirectory: tmpDir,
      });

      const actualPromise = context.secret('mySecret');

      await expect(actualPromise).rejects.toThrow(
        SecretBackendNotSpecifiedError,
      );
    });

    it('should render the configuration with secrets', async () => {
      const actualValue = (await context.getAndRender(
        'someValue',
      )) as unknown as string;
      const actualValue2 = (await context.getAndRenderOrThrow(
        'someValue',
      )) as unknown as string;

      expect(actualValue).toEndWith('🎉');
      expect(JSON.parse(actualValue.replace('🎉', ''))).toEqual({
        backend: 'default',
        configuration: { someConf: '🔑' },
      });
      expect(actualValue).toEqual(actualValue2);
    });
  });
});
