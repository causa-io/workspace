import { ImplementableFunction } from '../function-registry/index.js';
import { WorkspaceContext } from './context.js';

/**
 * The base class for workspace functions.
 * All function definitions should inherit from this class.
 * See {@link ImplementableFunction} for more details.
 */
export abstract class WorkspaceFunction<R> extends ImplementableFunction<
  WorkspaceContext,
  R
> {}
