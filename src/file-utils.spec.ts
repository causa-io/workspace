import { mkdir, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { listFilesAndFormat } from './file-utils.js';

describe('file-utils', () => {
  describe('listFilesAndFormat', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = resolve(await mkdtemp('causa-tests-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('should return matched files', async () => {
      await mkdir(join(tmpDir, 'allowed1/nested'), { recursive: true });
      await mkdir(join(tmpDir, 'allowed2/nested'), { recursive: true });
      await mkdir(join(tmpDir, 'nope'));
      await writeFile(join(tmpDir, 'allowed1/nested/first.test'), '🎁');
      await writeFile(join(tmpDir, 'allowed1/second.test'), '🎁');
      await writeFile(join(tmpDir, 'allowed2/nested/nope.test'), '🎁');
      await writeFile(join(tmpDir, 'allowed2/third.test'), '🎁');
      await writeFile(join(tmpDir, 'allowed2/nope.other'), '🎁');
      await writeFile(join(tmpDir, 'nope/no.test'), '🎁');
      await symlink(
        join(tmpDir, 'allowed1/second.test'),
        join(tmpDir, 'allowed1/nope.test'),
      );

      const actualMatches = await listFilesAndFormat(
        ['allowed1/**/*.test', 'allowed2/*.test'],
        /^allowed(?<num>[12])\/(.*\/)?(?<name>\w+)\.test$/,
        '${ num } - ${ name }',
        tmpDir,
      );

      expect(actualMatches).toEqual([
        {
          rendered: '1 - first',
          formatParts: { num: '1', name: 'first' },
          filePath: join(tmpDir, 'allowed1/nested/first.test'),
        },
        {
          rendered: '1 - second',
          formatParts: { num: '1', name: 'second' },
          filePath: join(tmpDir, 'allowed1/second.test'),
        },
        {
          rendered: '2 - third',
          formatParts: { num: '2', name: 'third' },
          filePath: join(tmpDir, 'allowed2/third.test'),
        },
      ]);
    });

    it('should call the non matching path handler when the regular expression does not match', async () => {
      await mkdir(join(tmpDir, 'allowed1/nested'), { recursive: true });
      await writeFile(join(tmpDir, 'allowed1/nested/first.test'), '🎁');
      await writeFile(join(tmpDir, 'allowed1/first.oops'), '🎁');
      await writeFile(join(tmpDir, 'allowed1/second.oopsAgain'), '🎁');

      const actualNonMatchingPaths: string[] = [];
      const actualMatches = await listFilesAndFormat(
        ['allowed1/**/*'],
        /^allowed(?<num>[12])\/(.*\/)?(?<name>\w+)\.test$/,
        '${ num } - ${ name }',
        tmpDir,
        { nonMatchingPathHandler: (path) => actualNonMatchingPaths.push(path) },
      );

      expect(actualMatches).toEqual([
        {
          rendered: '1 - first',
          formatParts: { num: '1', name: 'first' },
          filePath: join(tmpDir, 'allowed1/nested/first.test'),
        },
      ]);
      expect(actualNonMatchingPaths).toEqual([
        'allowed1/first.oops',
        'allowed1/second.oopsAgain',
      ]);
    });

    it('should work with a regular expression without named groups', async () => {
      await mkdir(join(tmpDir, 'allowed1'), { recursive: true });
      await writeFile(join(tmpDir, 'allowed1/first.test'), '🎁');
      await writeFile(join(tmpDir, 'allowed1/second.test'), '🎁');

      const actualMatches = await listFilesAndFormat(
        ['allowed1/**/*.test'],
        /^allowed1\/\w+\.test$/,
        'constant',
        tmpDir,
      );

      expect(actualMatches).toEqual([
        {
          rendered: 'constant',
          formatParts: {},
          filePath: join(tmpDir, 'allowed1/first.test'),
        },
        {
          rendered: 'constant',
          formatParts: {},
          filePath: join(tmpDir, 'allowed1/second.test'),
        },
      ]);
    });
  });
});
