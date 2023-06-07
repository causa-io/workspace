import { exec } from 'child_process';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import { Logger } from 'pino';
import { ModuleInstallationError } from './errors.js';

/**
 * The folder placed at the root of Causa workspaces, containing the npm installation.
 */
export const CAUSA_FOLDER = '.causa';

/**
 * The prefix used for npm module dependencies that are local paths.
 */
const NPM_FILE_PREFIX = 'file:';

/**
 * Initializes the Causa folder in the given workspace, installing the npm modules in the process.
 *
 * @param rootPath The root path of the workspace in which to create the Causa folder.
 * @param modules The modules to install in the Causa folder.
 * @param logger The logger to use.
 */
export async function setUpCausaFolder(
  rootPath: string,
  modules: Record<string, string>,
  logger: Logger,
): Promise<void> {
  const causaFolder = join(rootPath, CAUSA_FOLDER);

  await mkdir(causaFolder, { recursive: true });
  await makePackageFile(rootPath, modules);
  await installModules(causaFolder, logger);
}

/**
 * Creates the `package.json` file in the Causa folder, containing the given modules.
 * Modules that are relative local paths are resolved to absolute paths, starting from the workspace root.
 *
 * @param rootPath The root path of the workspace.
 * @param modules The modules to include in the package file.
 */
async function makePackageFile(
  rootPath: string,
  modules: Record<string, string>,
): Promise<void> {
  const dependencies = { ...modules };

  Object.entries(dependencies).forEach(([moduleName, moduleVersion]) => {
    if (moduleVersion.startsWith(NPM_FILE_PREFIX)) {
      dependencies[moduleName] = `${NPM_FILE_PREFIX}${resolve(
        rootPath,
        moduleVersion.slice(NPM_FILE_PREFIX.length),
      )}`;
    }
  });

  const packagePath = join(rootPath, CAUSA_FOLDER, 'package.json');
  await writeFile(packagePath, JSON.stringify({ dependencies }));
}

/**
 * Installs the npm modules in the Causa folder, after removing the existing `node_modules` folder.
 *
 * @param causaFolder The location of the Causa folder in which to install the modules.
 * @param logger The logger to use.
 */
async function installModules(
  causaFolder: string,
  logger: Logger,
): Promise<void> {
  const nodeModulesFolder = join(causaFolder, 'node_modules');

  logger.debug(
    `🔥 Removing existing node modules folder '${nodeModulesFolder}'.`,
  );
  await rm(nodeModulesFolder, { recursive: true, force: true });
  await rm(join(causaFolder, 'package-lock.json'), { force: true });

  logger.debug(`➕ Installing node modules in '${causaFolder}'.`);

  await new Promise<void>((resolve, reject) => {
    const child = exec('npm install --quiet', {
      cwd: causaFolder,
    });
    child.stderr?.pipe(process.stderr);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new ModuleInstallationError());
      }
    });
  });
}
