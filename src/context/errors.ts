/**
 * The base class for workspace context errors.
 */
export class WorkspaceContextError extends Error {}

/**
 * An error thrown when an attempt is made to access the context as a project (i.e. expecting `projectPath` to be
 * non-null).
 */
export class ContextNotAProjectError extends WorkspaceContextError {
  constructor(readonly workingDirectory: string) {
    super(
      `The current context with working directory '${workingDirectory}' is not a project.`,
    );
  }
}

/**
 * An error thrown when an attempt is made to access the environment ID in the context (i.e. expecting `environment` to
 * be non-null).
 */
export class EnvironmentNotSetError extends WorkspaceContextError {
  constructor() {
    super('The current context does not have an environment set.');
  }
}

/**
 * An error thrown when the file(s) found in the workspace are invalid.
 */
export class InvalidWorkspaceConfigurationFilesError extends WorkspaceContextError {}

/**
 * An error thrown when the module to load cannot be found.
 */
export class ModuleNotFoundError extends WorkspaceContextError {
  constructor(readonly moduleName: string) {
    super(`The module to load '${moduleName}' could not be found.`);
  }
}

/**
 * An error thrown when the version of the module to load cannot be fetched, or when the version does not match the
 * requirement from the configuration.
 */
export class ModuleVersionError extends WorkspaceContextError {
  constructor(
    readonly moduleName: string,
    readonly moduleVersion: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * An error thrown when a processor return value does not contain a valid configuration.
 */
export class InvalidProcessorOutputError extends WorkspaceContextError {
  constructor(readonly processor: string) {
    super(
      `The processor '${processor}' returned an invalid output, expected a configuration.`,
    );
  }
}

/**
 * The base class for secret-related errors.
 */
export class SecretError extends Error {}

/**
 * An error thrown when the secret definition found in the configuration is invalid.
 */
export class InvalidSecretDefinitionError extends SecretError {
  /**
   * Creates a new {@link InvalidSecretDefinitionError}.
   *
   * @param message The message describing the error.
   * @param secretId The ID of the secret.
   *   When throwing the error from a secret backend, this can be left undefined and will be populated by the fetcher.
   */
  constructor(message: string, readonly secretId?: string) {
    super(
      secretId
        ? `Invalid definition for secret '${secretId}': ${message}`
        : message,
    );
  }
}

/**
 * An error thrown when a secret references a backend that does not exist.
 */
export class SecretBackendNotFoundError extends SecretError {
  constructor(readonly backendId: string) {
    super(`Secret backend with ID '${backendId}' has not been registered.`);
  }
}

/**
 * An error thrown when the backend is not specified for a secret.
 * This means the secret's configuration does not have a `backend` value, and `causa.secrets.defaultBackend` is not
 * defined.
 */
export class SecretBackendNotSpecifiedError extends SecretError {
  constructor(readonly secretId: string) {
    super(
      `Secret with ID '${secretId}' cannot be fetched because no backend is specified.`,
    );
  }
}

/**
 * An error that can be thrown by any backend when the value for a secret cannot be fetched.
 */
export class SecretValueNotFoundError extends SecretError {}
