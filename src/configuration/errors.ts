/**
 * The base class for all configuration reader errors.
 */
export class ConfigurationReaderError extends Error {}

/**
 * An error thrown when attempting to access a value in the configuration which is a template, but has not been
 * rendered.
 */
export class UnformattedTemplateValueError extends ConfigurationReaderError {
  /**
   * Creates a new {@link UnformattedTemplateValueError}.
   *
   * @param path The path to the value in the configuration.
   */
  constructor(readonly path: string) {
    super(
      `The configuration value at path '${path}' or one of its children contains formatting, which is not supported.`,
    );
  }
}

/**
 * An error thrown when attempting to access a configuration value at a path that does not exist.
 */
export class ConfigurationValueNotFoundError extends ConfigurationReaderError {
  /**
   * Creates a new {@link ConfigurationValueNotFoundError}.
   *
   * @param path The path to the value in the configuration.
   */
  constructor(readonly path: string) {
    super(`The configuration value at path '${path}' does not exist.`);
  }
}

/**
 * An error thrown when a circular reference made by templates is found in the configuration.
 */
export class CircularTemplateReferenceError extends ConfigurationReaderError {
  constructor(readonly path: string) {
    super(
      `The template at path '${path}' in the configuration makes a circular reference.`,
    );
  }
}

/**
 * The base class for all renderer errors.
 */
export class AsyncTemplateRendererError extends Error {}

/**
 * An error thrown when the data referenced by a template cannot be fetched from the cache.
 */
export class ReferencedDataError extends AsyncTemplateRendererError {
  constructor(
    readonly fetcher: string,
    readonly args: any[],
  ) {
    super(`An error occurred while evaluating '${fetcher}(${args})'.`);
  }
}

/**
 * A generic error thrown when the rendering of a template string fails.
 */
export class TemplateRenderingError extends AsyncTemplateRendererError {
  constructor(
    readonly template: string,
    readonly error: any,
  ) {
    const message = error.message ?? error;
    super(
      `An error occurred while rendering template '${template}': '${message}'.`,
    );
  }
}
