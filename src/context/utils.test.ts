import { mkdir, writeFile } from 'fs/promises';
import { stringify } from 'yaml';
import { dirname, join } from 'path';
import type { PartialConfiguration } from '../configuration/index.js';
import type { BaseConfiguration } from './base-configuration.js';

export async function writeConfiguration(
  baseDir: string,
  relativePath: string,
  configuration: PartialConfiguration<BaseConfiguration>,
): Promise<void> {
  const fullPath = join(baseDir, relativePath);
  const dirPath = dirname(fullPath);

  await mkdir(dirPath, { recursive: true });

  const confStr = stringify(configuration);
  await writeFile(fullPath, confStr);
}
