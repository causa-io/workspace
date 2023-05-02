import { mkdtemp, rm } from 'fs/promises';
import { join, resolve } from 'path';
import {
  ConfigurationValueNotFoundError,
  PartialConfiguration,
} from '../configuration/index.js';
import { BaseConfiguration } from './base-configuration.js';
import { WorkspaceContext } from './context.js';
import { ContextNotAProjectError, EnvironmentNotSetError } from './errors.js';
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
});
