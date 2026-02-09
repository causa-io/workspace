import type { BaseConfigurationSchema, Workspace } from './generated.js';

/**
 * The schema for core elements of the configuration.
 */
export type BaseConfiguration = BaseConfigurationSchema & {
  readonly workspace: Workspace & { name: string };
};
