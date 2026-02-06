import { fileURLToPath } from 'url';
import type { WorkspaceContext } from './context.js';
import type { WorkspaceFunction } from './functions.js';

/**
 * Imports and calls a function from a separate file, binding it to the provided class instance and passing it the
 * provided context.
 *
 * The function file should be in the same directory as the caller, and have the same name with a `.call` suffix before
 * the extension.
 *
 * @param self The class instance to which the function will be bound when called.
 * @param context The {@link WorkspaceContext} of the function call.
 * @param from The URL of the file making the call.
 * @returns The result of the function call.
 */
export async function callDeferred<T>(
  self: WorkspaceFunction<Promise<T>>,
  context: WorkspaceContext,
  from: string,
): Promise<T> {
  const file = fileURLToPath(from.replace(/(\.[jt]s)$/, '.call$1'));
  const { default: fn } = await import(file);
  return fn.call(self, context);
}
