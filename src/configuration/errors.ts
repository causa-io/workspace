/**
 * The base class for all renderer errors.
 */
export class AsyncTemplateRendererError extends Error {}

/**
 * An error thrown when the data referenced by a template cannot be fetched from the cache.
 */
export class ReferencedDataError extends AsyncTemplateRendererError {
  constructor(readonly fetcher: string, readonly args: any[]) {
    super(`An error occurred while evaluating '${fetcher}(${args})'.`);
  }
}

/**
 * A generic error thrown when the rendering of a template string fails.
 */
export class TemplateRenderingError extends AsyncTemplateRendererError {
  constructor(readonly template: string, readonly error: any) {
    const message = error.message ?? error;
    super(
      `An error occurred while rendering template '${template}': '${message}'.`,
    );
  }
}
