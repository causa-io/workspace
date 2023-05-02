import { cloneDeep, isArray, isEqual, template } from 'lodash-es';
import { ReferencedDataError, TemplateRenderingError } from './errors.js';

/**
 * A value that can be used in a template.
 */
export type DataValue = {} | null;

/**
 * A function that asynchronously fetches a configuration value.
 * Arguments are passed by the template (usually a single string).
 */
export type DataFetcher = (...args: any[]) => Promise<DataValue>;

/**
 * A map where keys are names of functions that will be exposed to the templates, and values are the corresponding
 * {@link DataFetcher}.
 */
export type DataFetchers = Record<string, DataFetcher>;

/**
 * A data fetcher evaluation referenced in the template.
 */
type ReferencedData = {
  /**
   * The arguments passed to the data fetcher by the template, uniquely referencing the data.
   */
  args: any[];

  /**
   * The data returned by the {@link DataFetcher}.
   * This is `undefined` before {@link AsyncTemplateRenderer.fetchData} has been called.
   */
  data: DataValue | undefined;
};

/**
 * Handles the parsing and the evaluation of templates in a configuration object.
 * This makes use of `lodash`'s {@link template} function, but allows calling async functions in templates without using
 * the cumbersome `await` keyword.
 * Templates are defined in the object to render as child objects containing a single "template key", for which the
 * value is the template to render.
 *
 * @example
 * ```typescript
 * const renderer = new AsyncTemplateRenderer('$format', {
 *   callMe: async (str: string) => `processed-${str}`
 * });
 * const rendered = await renderer.render({
 *   key1: 'value1',
 *   key2: { $format: "${ callMe('value2') }" },
 * })
 * // rendered = { key1: 'value1', key2: 'processed-value2' }
 * ```
 */
export class AsyncTemplateRenderer {
  /**
   * Holds the list of all (unique) data fetcher evaluations referenced in templates.
   * After {@link AsyncTemplateRenderer.fetchData} has been called, this also contains the returned values that can be
   * passed to the templates.
   */
  private readonly dataCache: Record<string, ReferencedData[]> = {};

  /**
   * The object passed to the rendering functions during the parsing stage, which contains "mock" implementations of the
   * data fetchers.
   * Instead of evaluating the values, the implementations build the {@link AsyncTemplateRenderer.dataCache} (without
   * populating the {@link ReferencedData.data} fields, leaving them to `undefined`).
   */
  private readonly cacheBuilders: Record<string, (...args: any[]) => void> = {};

  /**
   * The object passed to the rendering functions during the rendering stage, which returns the data fetcher values
   * stored in the {@link AsyncTemplateRenderer.dataCache}.
   */
  private readonly cacheDataFinders: Record<string, (...args: any[]) => any> =
    {};

  /**
   * Creates a new {@link AsyncTemplateRenderer}.
   *
   * @param templateKey The key indicating that an object should be evaluated as a template.
   * @param dataFetchers The {@link DataFetcher}s made available to the templates.
   */
  constructor(
    readonly templateKey: string,
    readonly dataFetchers: DataFetchers,
  ) {
    Object.keys(this.dataFetchers).forEach((fetcherName) => {
      this.dataCache[fetcherName] = [];

      this.cacheBuilders[fetcherName] = (...args) => {
        const cache = this.dataCache[fetcherName];
        if (cache.findIndex(({ args: a }) => isEqual(a, args)) >= 0) {
          return;
        }

        cache.push({ args, data: undefined });
      };

      this.cacheDataFinders[fetcherName] = (...args) => {
        const cache = this.dataCache[fetcherName];
        const fetchedData = cache.find(({ args: a }) => isEqual(a, args));
        if (fetchedData?.data === undefined) {
          throw new ReferencedDataError(fetcherName, args);
        }

        return fetchedData.data;
      };
    });
  }

  /**
   * Populates the {@link ReferencedData.data} field in all objects of the {@link AsyncTemplateRenderer.dataCache} with
   * the response of the corresponding data fetcher.
   */
  private async fetchData(): Promise<void> {
    const fetchTasks = Object.entries(this.dataCache).flatMap(
      ([fetcherName, fetchedDataList]) =>
        fetchedDataList.map((fetchedData) => ({ fetcherName, fetchedData })),
    );

    await Promise.all(
      fetchTasks.map(async ({ fetcherName, fetchedData }) => {
        const data = await this.dataFetchers[fetcherName](...fetchedData.args);
        fetchedData.data = data;
      }),
    );
  }

  /**
   * Walks an object recursively, looking for templates and evaluating them using the provided function.
   *
   * @param obj The object to transform.
   * @param transform The function rendering the template.
   *   If it returns `undefined`, the template is left untouched in the object.
   * @returns The transformed object.
   */
  private transformTemplatesRecursively(
    obj: any,
    transform: (tpl: string) => any,
  ): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (isArray(obj)) {
      return obj.map((i) => this.transformTemplatesRecursively(i, transform));
    }

    if (isEqual(Object.keys(obj), [this.templateKey])) {
      const template = obj[this.templateKey];
      try {
        const transformedValue = transform(template);
        return transformedValue !== undefined ? transformedValue : obj;
      } catch (error) {
        throw new TemplateRenderingError(template, error);
      }
    }

    Object.keys(obj).forEach((key) => {
      obj[key] = this.transformTemplatesRecursively(obj[key], transform);
    });
    return obj;
  }

  /**
   * Recursively walks the given object, looking for templates. The found templates are evaluated, possibly calling data
   * fetchers in the process.
   *
   * @param obj The object to transform. A deep copy of the object will be made.
   * @returns The object with its template having been rendered.
   */
  async render<T>(obj: T): Promise<T> {
    const newObj = cloneDeep(obj);

    this.transformTemplatesRecursively(newObj, (tpl) => {
      template(tpl)(this.cacheBuilders);
    });

    await this.fetchData();

    return this.transformTemplatesRecursively(newObj, (tpl) =>
      template(tpl)(this.cacheDataFinders),
    );
  }

  /**
   * Checks whether the given object or its children contains a template that should be formatted.
   *
   * @param templateKey The key indicating that an object should be evaluated as a template.
   * @param obj The object to test.
   * @returns `true` if the object or one of its children contains a template.
   */
  static containsRenderingObject(templateKey: string, obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    if (isArray(obj)) {
      return obj.some((i) =>
        AsyncTemplateRenderer.containsRenderingObject(templateKey, i),
      );
    }

    if (isEqual(Object.keys(obj), [templateKey])) {
      return true;
    }

    return Object.values(obj).some((value) =>
      AsyncTemplateRenderer.containsRenderingObject(templateKey, value),
    );
  }
}
