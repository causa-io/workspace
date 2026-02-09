import { resolve } from 'path';
import { fileURLToPath } from 'url';
import type { BaseConfigurationSchema, Workspace } from './generated.js';

/**
 * The path to the JSON Schema file defining the base configuration.
 */
export const BASE_CONFIGURATION_SCHEMA_PATH = resolve(
  fileURLToPath(import.meta.url),
  './schemas/base-configuration.yaml',
);

/**
 * The schema for core elements of the configuration.
 */
export type BaseConfiguration = BaseConfigurationSchema & {
  readonly workspace: Workspace & { name: string };
};
