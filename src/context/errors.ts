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
