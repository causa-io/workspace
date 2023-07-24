import { mkdtemp, rm } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { Logger, pino } from 'pino';
import {
  ConfigurationReader,
  ConfigurationReaderSourceType,
  ConfigurationValueNotFoundError,
  PartialConfiguration,
} from '../configuration/index.js';
import { BaseConfiguration } from './base-configuration.js';
import {
  WorkspaceConfigurationSourceType,
  listProjectPaths,
  loadWorkspaceConfiguration,
  makeProcessorConfiguration,
} from './configuration.js';
import { InvalidWorkspaceConfigurationFilesError } from './errors.js';
import { writeConfiguration } from './utils.test.js';

describe('configuration', () => {
  describe('loadWorkspaceConfiguration', () => {
    let tmpDir: string;
    let logger: Logger;

    beforeEach(async () => {
      tmpDir = resolve(await mkdtemp('causa-tests-'));
      logger = pino();
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('should throw an error when no configuration can be found', async () => {
      const actualPromise = loadWorkspaceConfiguration(tmpDir, null, logger);

      await expect(actualPromise).rejects.toThrow(
        InvalidWorkspaceConfigurationFilesError,
      );
    });

    it('should load a single configuration', async () => {
      const expectedConfiguration = { workspace: { name: 'my-workspace' } };
      await writeConfiguration(tmpDir, './causa.yaml', expectedConfiguration);

      const actualConfiguration = await loadWorkspaceConfiguration(
        tmpDir,
        null,
        logger,
      );

      expect(actualConfiguration).toEqual({
        configuration: expect.any(ConfigurationReader),
        rootPath: tmpDir,
        projectPath: null,
      });
      expect(actualConfiguration.configuration.get()).toEqual(
        expectedConfiguration,
      );
      expect(actualConfiguration.configuration.rawConfigurations).toEqual([
        {
          sourceType: ConfigurationReaderSourceType.File,
          source: join(tmpDir, 'causa.yaml'),
          configuration: expectedConfiguration,
        },
      ]);
    });

    it('should throw when the configuration does not contain a workspace name', async () => {
      await writeConfiguration(tmpDir, './causa.yaml', {
        workspace: { description: '🙈' },
      });

      const actualPromise = loadWorkspaceConfiguration(tmpDir, null, logger);

      await expect(actualPromise).rejects.toThrow(
        InvalidWorkspaceConfigurationFilesError,
      );
    });

    it('should throw when specifying an environment that does not exist', async () => {
      await writeConfiguration(tmpDir, './causa.yaml', {
        workspace: { name: 'my-workspace' },
        environments: {
          dev: { name: 'Dev 🪛', configuration: {} },
        },
      });

      const actualPromise = loadWorkspaceConfiguration(tmpDir, '🚀', logger);

      await expect(actualPromise).rejects.toThrow(
        ConfigurationValueNotFoundError,
      );
    });

    it('should load a configuration with an environment', async () => {
      const configuration: PartialConfiguration<BaseConfiguration> = {
        workspace: { name: 'my-workspace' },
        environments: {
          dev: {
            name: 'Dev 🪛',
            configuration: { secrets: { devSecret: {} } },
          },
        },
      };
      await writeConfiguration(tmpDir, './causa.yaml', configuration);
      const expectedConfiguration = {
        ...configuration,
        ...configuration.environments?.dev.configuration,
      };

      const actualConfiguration = await loadWorkspaceConfiguration(
        tmpDir,
        'dev',
        logger,
      );

      expect(actualConfiguration).toEqual({
        configuration: expect.any(ConfigurationReader),
        rootPath: tmpDir,
        projectPath: null,
      });
      expect(actualConfiguration.configuration.get()).toEqual(
        expectedConfiguration,
      );
      expect(actualConfiguration.configuration.rawConfigurations).toEqual([
        {
          sourceType: ConfigurationReaderSourceType.File,
          source: join(tmpDir, 'causa.yaml'),
          configuration: configuration,
        },
        {
          sourceType: WorkspaceConfigurationSourceType.Environment,
          source: 'dev',
          configuration: configuration.environments?.dev.configuration,
        },
      ]);
    });

    it('should load several files and infer the project path', async () => {
      const workspaceConfiguration: PartialConfiguration<BaseConfiguration> = {
        workspace: { name: 'my-workspace' },
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
      const expectedConfiguration = {
        ...workspaceConfiguration,
        ...projectConfiguration,
      };
      const expectedProjectDir = join(tmpDir, 'project');

      const actualConfiguration = await loadWorkspaceConfiguration(
        expectedProjectDir,
        null,
        logger,
      );

      expect(actualConfiguration).toEqual({
        configuration: expect.any(ConfigurationReader),
        rootPath: tmpDir,
        projectPath: expectedProjectDir,
      });
      expect(actualConfiguration.configuration.get()).toEqual(
        expectedConfiguration,
      );
      expect(actualConfiguration.configuration.rawConfigurations).toEqual([
        {
          sourceType: ConfigurationReaderSourceType.File,
          source: join(tmpDir, 'causa.yaml'),
          configuration: workspaceConfiguration,
        },
        {
          sourceType: ConfigurationReaderSourceType.File,
          source: join(tmpDir, 'project', 'causa.yaml'),
          configuration: projectConfiguration,
        },
      ]);
    });

    it('should throw when the workspace is defined in two different places', async () => {
      await writeConfiguration(tmpDir, './causa.yaml', {
        workspace: { name: 'my-workspace' },
      });
      await writeConfiguration(tmpDir, './project/causa.yaml', {
        workspace: { name: 'my-other-workspace' },
      });

      const actualPromise = loadWorkspaceConfiguration(
        join(tmpDir, 'project'),
        null,
        logger,
      );

      await expect(actualPromise).rejects.toThrow(
        InvalidWorkspaceConfigurationFilesError,
      );
    });
  });

  describe('makeProcessorConfiguration', () => {
    it('should return the raw configuration', () => {
      const actualConfiguration = makeProcessorConfiguration('MyProcessor', {
        someValue: 'a',
      });

      expect(actualConfiguration).toEqual({
        configuration: { someValue: 'a' },
        sourceType: WorkspaceConfigurationSourceType.Processor,
        source: 'MyProcessor',
      });
    });
  });

  describe('listProjectPaths', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = resolve(await mkdtemp('causa-tests-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('should return an empty list when no configuration can be found', async () => {
      const actualPaths = await listProjectPaths(tmpDir);

      expect(actualPaths).toBeEmpty();
    });

    it('should return a single path at the root of the workspace', async () => {
      await writeConfiguration(tmpDir, './causa.yaml', {
        workspace: { name: 'my-workspace' },
        project: { name: 'my-project', type: '🐍', language: '🇫🇷' },
      });

      const actualPaths = await listProjectPaths(tmpDir);

      expect(actualPaths).toEqual([tmpDir]);
    });

    it('should return several paths', async () => {
      await writeConfiguration(tmpDir, './causa.yaml', {
        workspace: { name: 'my-workspace' },
      });
      await writeConfiguration(tmpDir, './project1/causa.yaml', {
        project: { name: 'my-project', type: '🐍', language: '🇫🇷' },
      });
      await writeConfiguration(tmpDir, './project2/causa.myproj.yaml', {
        project: { name: 'my-other-project', type: '🐍', language: '🇫🇷' },
      });
      await writeConfiguration(tmpDir, './nope/causa.yaml', { causa: {} });

      const actualPaths = await listProjectPaths(tmpDir);

      expect(actualPaths).toContainAllValues([
        join(tmpDir, 'project1'),
        join(tmpDir, 'project2'),
      ]);
    });
  });
});
