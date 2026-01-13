import { WorkspaceFunction } from './functions.js';

/**
 * Describes a {@link ProcessorFunction} to run when initializing the workspace context.
 * The return value of the function will be used to update the configuration.
 */
export type ProcessorInstruction = {
  /**
   * The name of the {@link WorkspaceFunction}.
   */
  name: string;

  /**
   * Arguments for the workspace function.
   */
  args?: Record<string, any>;
};

/**
 * The return value of a {@link ProcessorFunction}.
 */
export type ProcessorResult = {
  /**
   * A partial configuration that will be merged into the workspace configuration.
   */
  configuration: Record<string, any>;
};

/**
 * A {@link WorkspaceFunction} that can be used as a processor when creating a workspace context.
 * Its return value should contain a configuration object that will be merged into the workspace configuration.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ProcessorFunction extends WorkspaceFunction<
  Promise<ProcessorResult>
> {}
