import { mkdtemp, readFile, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { type Logger, pino } from 'pino';
import { ModuleInstallationError } from './errors.js';
import { setUpCausaFolder } from './installation.js';

describe('installation', () => {
  let tmpDir: string;
  let logger: Logger;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-tests-'));
    logger = pino();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('setUpCausaFolder', () => {
    it('should set up the Causa folder in the workspace', async () => {
      await setUpCausaFolder(tmpDir, { 'is-even': '1.0.0' }, logger);

      const actualPackageFile = await readFile(
        join(tmpDir, '.causa', 'package.json'),
      );
      const actualPackageDefinition = JSON.parse(actualPackageFile.toString());
      expect(actualPackageDefinition).toEqual({
        dependencies: { 'is-even': '1.0.0' },
      });
      await expect(
        stat(join(tmpDir, '.causa', 'node_modules')),
      ).resolves.toBeTruthy();
    }, 60000);
  });

  it('should resolve local packages', async () => {
    await setUpCausaFolder(
      tmpDir,
      {
        '@causa/local': 'file:/some/absolute/path',
        '@causa/local2': 'file:relative/path',
        'is-even': '1.0.0',
      },
      logger,
    );

    const actualPackageFile = await readFile(
      join(tmpDir, '.causa', 'package.json'),
    );
    const actualPackageDefinition = JSON.parse(actualPackageFile.toString());
    expect(actualPackageDefinition).toEqual({
      dependencies: {
        '@causa/local': 'file:/some/absolute/path',
        '@causa/local2': `file:${join(tmpDir, 'relative/path')}`,
        'is-even': '1.0.0',
      },
    });
    await expect(
      stat(join(tmpDir, '.causa', 'node_modules')),
    ).resolves.toBeTruthy();
  });

  it('should prefer deduplication when installing modules', async () => {
    await setUpCausaFolder(
      tmpDir,
      { '@causa/cli': '*', '@causa/workspace-core': '0.34.0' },
      logger,
    );

    const actualCliPackageFile = await readFile(
      join(tmpDir, '.causa', 'node_modules', '@causa', 'cli', 'package.json'),
    );
    const actualCliVersion = JSON.parse(
      actualCliPackageFile.toString(),
    ).version;
    // Without deduplication, the latest `@causa/cli` (`>= 1.0.0`) would be installed at the top level, with an older
    // version nested in `@causa/workspace-core`.
    const actualCliMajor = Number(actualCliVersion.split('.')[0]);
    expect(actualCliMajor).toBeLessThan(1);
  }, 60000);

  it('should throw an error when installing the modules fails', async () => {
    const actualPromise = setUpCausaFolder(
      tmpDir,
      { '@causa/nope': '1.0.0', 'is-even': '1.0.0' },
      logger,
    );

    await expect(actualPromise).rejects.toThrow(ModuleInstallationError);
    const actualPackageFile = await readFile(
      join(tmpDir, '.causa', 'package.json'),
    );
    const actualPackageDefinition = JSON.parse(actualPackageFile.toString());
    expect(actualPackageDefinition).toEqual({
      dependencies: {
        '@causa/nope': '1.0.0',
        'is-even': '1.0.0',
      },
    });
  });
});
