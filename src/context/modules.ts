import { readFile } from 'fs/promises';
import { dirname } from 'path';
import { Logger } from 'pino';
import resolvePackagePath from 'resolve-package-path';
import { satisfies, validRange } from 'semver';
import { fileURLToPath } from 'url';
import {
  FunctionRegistry,
  ImplementableFunctionImplementationConstructor,
} from '../function-registry/index.js';
import { WorkspaceConfiguration } from './configuration.js';
import { WorkspaceContext } from './context.js';
import {
  IncompatibleModuleVersionError,
  ModuleNotFoundError,
  ModuleVersionError,
} from './errors.js';
import { WorkspaceFunction } from './functions.js';

/**
 * The context passed to the {@link ModuleRegistrationFunction}, allowing the module to register various components in
 * the workspace.
 */
export type ModuleRegistrationContext = {
  /**
   * Registers one or several implementations of workspace functions.
   *
   * @param implementations The constructors for the workspace function classes to register.
   */
  registerFunctionImplementations(
    ...implementations: ImplementableFunctionImplementationConstructor<
      WorkspaceFunction<any>
    >[]
  ): void;
};

/**
 * A function that registers a module's capabilities to the given workspace context.
 * This function should be the default export for the module.
 */
export type ModuleRegistrationFunction = (
  context: ModuleRegistrationContext,
) => Promise<void>;

/**
 * Ensures that the version of the given module satisfies the given `semver` requirement.
 * The current version of the module is read from its `package.json` file.
 *
 * @param moduleName The name of the module that will be imported.
 * @param moduleVersion The expected `semver` for the module's version.
 */
async function checkModuleVersion(
  moduleName: string,
  moduleVersion: string,
): Promise<void> {
  const basePath = dirname(fileURLToPath(import.meta.url));
  const packagePath = resolvePackagePath(moduleName, basePath);
  if (!packagePath) {
    throw new ModuleNotFoundError(moduleName);
  }

  let version: string;
  try {
    const packageContent = await readFile(packagePath);
    const packageInfo = JSON.parse(packageContent.toString());
    version = packageInfo.version;
  } catch (error: any) {
    const message = error.message ?? error;
    throw new ModuleVersionError(
      moduleName,
      moduleVersion,
      `Failed to fetch the version for package '${moduleName}': '${message}'.`,
    );
  }

  if (!version) {
    throw new ModuleVersionError(
      moduleName,
      moduleVersion,
      `Failed to find the version in the package.json for '${moduleName}'.`,
    );
  }

  if (!satisfies(version, moduleVersion)) {
    throw new IncompatibleModuleVersionError(
      moduleName,
      version,
      moduleVersion,
    );
  }
}

/**
 * Loads a module in the context, making new functions, secret backends, etc available.
 * If `moduleVersion` is a valid semantic version (range), it is checked against the version of the module.
 * Invalid semantic versions (e.g. local paths) are ignored.
 *
 * @param moduleName The name of the JavaScript module, as it would be loaded from JavaScript code.
 * @param moduleVersion The expected version for the module, as a `semver` string.
 * @param functionRegistry The {@link FunctionRegistry} to which functions should be registered.
 * @param logger The logger to use.
 */
async function loadModule(
  moduleName: string,
  moduleVersion: string,
  functionRegistry: FunctionRegistry<WorkspaceContext>,
  logger: Logger,
): Promise<void> {
  try {
    logger.debug(`🔨 Loading module '${moduleName}'.`);

    if (validRange(moduleVersion)) {
      await checkModuleVersion(moduleName, moduleVersion);
    }

    const registerModule = (await import(moduleName))
      .default as ModuleRegistrationFunction;

    logger.debug(`🔨 Registering module '${moduleName}'.`);
    await registerModule({
      registerFunctionImplementations: (...implementations) =>
        functionRegistry.registerImplementations(...implementations),
    });
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      throw new ModuleNotFoundError(moduleName);
    }

    throw error;
  }
}

/**
 * Loads the core module, as well as all the modules listed in the workspace configuration.
 *
 * @param configuration The {@link WorkspaceConfiguration} from which the list modules be read.
 * @param functionRegistry The {@link FunctionRegistry} to which functions should be registered.
 * @param logger The logger to use.
 */
export async function loadModules(
  configuration: WorkspaceConfiguration,
  functionRegistry: FunctionRegistry<WorkspaceContext>,
  logger: Logger,
): Promise<void> {
  const modulesAndVersions = Object.entries(
    configuration.get('causa.modules') ?? {},
  );
  if (modulesAndVersions.length > 0) {
    logger.debug(
      `🔨 Found the following modules to load in the configuration: ${modulesAndVersions
        .map((m) => `'${m[0]}'`)
        .join(', ')}.`,
    );
  }

  await Promise.all(
    modulesAndVersions.map(([moduleName, moduleVersion]) =>
      loadModule(moduleName, moduleVersion, functionRegistry, logger),
    ),
  );
}
