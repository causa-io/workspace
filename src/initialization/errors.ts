/**
 * An error thrown when Causa initialization fails.
 */
export class InitializationError extends Error {}

/**
 * An error thrown when installing Causa dependencies using npm fails.
 */
export class ModuleInstallationError extends InitializationError {
  constructor() {
    super('Installation of Causa modules using npm failed.');
  }
}
