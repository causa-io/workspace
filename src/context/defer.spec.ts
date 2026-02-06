import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { callDeferred } from './defer.js';

describe('callDeferred', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp(join(tmpdir(), 'causa-tests-')));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should import the .call sibling and call it bound to self with the context', async () => {
    const callFile = join(tmpDir, 'my-function.call.js');
    await writeFile(
      callFile,
      `module.exports = function(context) { return \`\${this.someProperty}|\${context.testValue}\`; };`,
    );
    const self = { someProperty: '🎸' } as any;
    const context = { testValue: '🎵' } as any;
    const from = pathToFileURL(join(tmpDir, 'my-function.js')).toString();

    const actualResult = await callDeferred(self, context, from);

    expect(actualResult).toEqual('🎸|🎵');
  });
});
