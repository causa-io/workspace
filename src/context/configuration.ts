import { readdir, readFile } from 'fs/promises';
import { load } from 'js-yaml';
import { get } from 'lodash-es';
import { dirname, join } from 'path';
import { Logger } from 'pino';
import {
  ConfigurationReader,
  ConfigurationReaderSourceType,
  GetFieldType,
  PartialConfiguration,
  RawConfiguration,
} from '../configuration/index.js';
import { BaseConfiguration } from './base-configuration.js';
import { InvalidWorkspaceConfigurationFilesError } from './errors.js';

/**
 * The regular expression matching workspace (and project) configuration files.
 */
const DEFAULT_CONFIGURATION_REGEXP = [/^causa(\..*)?\.yaml$/];

/**
 * A {@link ConfigurationReader} specified to read the configuration of a workspace.
 */
export type WorkspaceConfiguration = ConfigurationReader<BaseConfiguration>;

/**
 * Additional types of configuration sources supported by a workspace context.
 */
export enum WorkspaceConfigurationSourceType {
  /**
   * The configuration is specific to a workspace environment.
   */
  Environment = 'environment',

  /**
   * The configuration was added from the output of a processor.
   */
  Processor = 'processor',
}

/**
 * Loads all the file configurations located in a folder or its parents.
 * Configurations are returned such that files located closer to the root of the file system appear first.
 * In a single folder, files are returned in descending alphabetical order.
 *
 * @param basePath The path from which the search is started, then moving up the folder hierarchy.
 * @param fileRegexps The list of regular expressions from which a filename should produce at least one match to be
 *   considered a configuration file.
 * @returns The list of {@link RawConfiguration}s.
 */
async function loadRawConfigurations<T extends object>(
  basePath: string,
  fileRegexps: RegExp[],
): Promise<RawConfiguration<T>[]> {
  const directories = [basePath];

  while (dirname(directories[0]) !== directories[0]) {
    directories.splice(0, 0, dirname(directories[0]));
  }

  const nestedConfigurations = await Promise.all(
    directories.map(async (path) => {
      const files = await readdir(path);

      const configurationFiles = files
        .filter((file) => fileRegexps.some((r) => file.match(r)))
        .sort()
        .reverse();

      return await Promise.all(
        configurationFiles.map(
          async (fileName): Promise<RawConfiguration<T>> => {
            const source = join(path, fileName);
            const content = await readFile(source, { encoding: 'utf-8' });
            const configuration = load(content) as any;
            return {
              sourceType: ConfigurationReaderSourceType.File,
              source,
              configuration,
            };
          },
        ),
      );
    }),
  );

  return nestedConfigurations.flatMap((c) => c);
}

/**
 * Looks for a single {@link RawConfiguration} with a non-null value at a given (object) path.
 * Returns the folder in which the configuration is located.
 * If more than one configuration matches, an error is thrown.
 *
 * @param rawConfigurations The list of raw configurations from which the path should be extracted.
 * @param nonNullConfigurationPath A path in the raw configuration that should be non-null for it to be selected.
 * @returns The file path to the only matching configuration, or `null` if no configuration matched.
 */
function findPathInConfigurations(
  rawConfigurations: RawConfiguration<BaseConfiguration>[],
  nonNullConfigurationPath: string,
): string | null {
  const matchingConfigurations = rawConfigurations.filter(
    (rawConfiguration) =>
      rawConfiguration.sourceType === ConfigurationReaderSourceType.File &&
      get(rawConfiguration.configuration, nonNullConfigurationPath) != null,
  );

  if (matchingConfigurations.length === 0) {
    return null;
  }

  if (matchingConfigurations.length > 1) {
    throw new InvalidWorkspaceConfigurationFilesError(
      `More than one configuration file were found with '${nonNullConfigurationPath}' set.`,
    );
  }

  const source = matchingConfigurations[0].source;
  if (!source) {
    throw new InvalidWorkspaceConfigurationFilesError(
      `Unexpected null source for configuration file with '${nonNullConfigurationPath}' set.`,
    );
  }

  return dirname(source);
}

/**
 * A configuration loaded from a working directory.
 */
export type LoadedWorkspaceConfiguration = {
  /**
   * The configuration loaded from the files.
   */
  configuration: WorkspaceConfiguration;

  /**
   * The root directory of the workspace, inferred from the configuration files.
   */
  rootPath: string;

  /**
   * The root directory of the project within the workspace, inferred from the configuration files.
   * This can be `null` if the working directory is not located in a project.
   */
  projectPath: string | null;
};

/**
 * Sets up a {@link ConfigurationReader} using the given working directory as a starting point.
 * Configuration files found along the way are also used to determine the location of the workspace and project root
 * paths.
 *
 * @param workingDirectory The working directory from which the configuration should be loaded.
 * @param environmentId The ID of the environment for which the configuration should be set up. Can be `null`.
 * @param logger The logger to use.
 * @returns The configuration, along with the inferred workspace and project paths.
 */
export async function loadWorkspaceConfiguration(
  workingDirectory: string,
  environmentId: string | null,
  logger: Logger,
): Promise<LoadedWorkspaceConfiguration> {
  logger.debug(
    `🔧 Looking for configurations starting from working directory '${workingDirectory}'.`,
  );

  const configurations = await loadRawConfigurations<BaseConfiguration>(
    workingDirectory,
    DEFAULT_CONFIGURATION_REGEXP,
  );
  if (configurations.length === 0) {
    throw new InvalidWorkspaceConfigurationFilesError(
      `No configuration file was found starting at working directory '${workingDirectory}'.`,
    );
  }

  let configuration = new ConfigurationReader(configurations);

  if (environmentId) {
    logger.debug(
      `🔧 Setting up configuration for environment '${environmentId}'.`,
    );

    const { configuration: envConf } = configuration.getOrThrow(
      `environments.${environmentId}`,
    );

    if (envConf) {
      configuration = configuration.mergedWith({
        configuration: envConf,
        sourceType: WorkspaceConfigurationSourceType.Environment,
        source: environmentId,
      });
    }
  }

  const rootPath = findPathInConfigurations(configurations, 'workspace.name');
  if (!rootPath) {
    throw new InvalidWorkspaceConfigurationFilesError(
      `Workspace root path could not be found when starting from working directory '${workingDirectory}'.`,
    );
  }
  logger.debug(`📂 Found root of workspace at '${rootPath}'.`);

  const projectPath = findPathInConfigurations(configurations, 'project.name');
  if (projectPath) {
    logger.debug(`📂 Found root of project at '${projectPath}'.`);
  }

  return { configuration, rootPath, projectPath };
}

/**
 * Creates a {@link RawConfiguration} from the output of a processor.
 * The {@link RawConfiguration.source} is the name of the processor.
 *
 * @param name The name of the processor.
 * @param configuration The configuration from the processor's output.
 * @returns The {@link RawConfiguration}.
 */
export function makeProcessorConfiguration<T = any>(
  name: string,
  configuration: PartialConfiguration<T>,
): RawConfiguration<T> {
  return {
    configuration,
    sourceType: WorkspaceConfigurationSourceType.Processor,
    source: name,
  };
}

/**
 * An object providing configuration getters with types from a project-specific configuration.
 */
export type TypedWorkspaceConfiguration<C extends object> = {
  /**
   * Returns the value at a given path in the configuration.
   *
   * @param path The path to the value in the configuration object.
   * @returns The value, or `undefined` if the path does not exist.
   */
  get: <TPath extends string>(
    path: TPath,
  ) => GetFieldType<BaseConfiguration & C, TPath>;

  /**
   * Returns the value at a given path in the configuration, or throws an error if the path does not exist.
   *
   * @param path The path to the value in the configuration object.
   * @returns The value in the configuration.
   */
  getOrThrow: <TPath extends string>(
    path: TPath,
  ) => Exclude<GetFieldType<BaseConfiguration & C, TPath>, undefined>;

  /**
   * Renders the value at a given path in the configuration object, by recursively walking the value and processing
   * templates.
   *
   * @param path The path to the value in the configuration object.
   * @returns The value after rendering.
   */
  getAndRender: <TPath extends string>(
    path: TPath,
  ) => Promise<GetFieldType<BaseConfiguration & C, TPath>>;

  /**
   * Renders the value at a given path in the configuration object, by recursively walking the value and processing
   * templates. If the value does not exist in the configuration, this throws an error instead of returning `undefined`.
   *
   * @param path The path to the value in the configuration object.
   * @returns The value after rendering.
   */
  getAndRenderOrThrow: <TPath extends string>(
    path: TPath,
  ) => Promise<Exclude<GetFieldType<BaseConfiguration & C, TPath>, undefined>>;
};
