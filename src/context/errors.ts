/**
 * The base class for workspace context errors.
 */
export class WorkspaceContextError extends Error {}

/**
 * An error thrown when the file(s) found in the workspace are invalid.
 */
export class InvalidWorkspaceConfigurationFilesError extends WorkspaceContextError {}
