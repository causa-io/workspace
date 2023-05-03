import { IsObject, IsString } from 'class-validator';
import { WorkspaceFunction } from './functions.js';

/**
 * Fetches the value of a secret used in the configuration.
 * This function should be implemented by modules providing secret backends.
 * The implementation's {@link WorkspaceFunction._supports} should check the {@link SecretFetch.backend} value and only
 * return `true` if it is the target backend.
 * Because secrets are usually fetched when rendering (part of) the configuration, the {@link SecretFetch}
 * implementation should avoid calling `context.getAndRender` itself, and preferably use `context.get` instead.
 * Returns the value of the secret.
 */
export abstract class SecretFetch extends WorkspaceFunction<Promise<string>> {
  /**
   * The backend that should be used to fetch the secret.
   */
  @IsString()
  readonly backend!: string;

  /**
   * The configuration object for the secret, obtained from the workspace configuration.
   * This is a generic object for which the schema will vary depending on the backend.
   */
  @IsObject()
  readonly configuration!: Record<string, any>;
}
