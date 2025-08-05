import type { GetFieldType } from 'lodash';
import { cloneDeep, get, isArray, mergeWith } from 'lodash-es';
import {
  CircularTemplateReferenceError,
  ConfigurationValueNotFoundError,
  UnformattedTemplateValueError,
} from './errors.js';
import {
  AsyncTemplateRenderer,
  type DataFetchers,
} from './template-renderer.js';
export type { GetFieldType } from 'lodash';

/**
 * The default key in configuration objects marking a value as being a template that should be evaluated.
 */
const DEFAULT_TEMPLATE_KEY = '$format';

/**
 * Options for the {@link ConfigurationReader.get} method.
 */
export type ConfigurationGetOptions = {
  /**
   * When set to `true`, bypasses the check for unformatted template values.
   */
  unsafe?: boolean;
};

/**
 * The types of source supported by the base {@link ConfigurationReader}.
 */
export enum ConfigurationReaderSourceType {
  /**
   * The configuration was loaded from a file on the disk.
   * The {@link RawConfiguration.source} is the path to the file on the disk.
   */
  File = 'file',
}

/**
 * Recursively makes all properties partial in the given type.
 */
export type PartialConfiguration<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? PartialConfiguration<U>[]
    : T[P] extends object
      ? PartialConfiguration<T[P]>
      : T[P];
};

/**
 * A single configuration loaded from a single source, which is only a part of the full configuration.
 */
export type RawConfiguration<T> = {
  /**
   * The type of source from which the configuration was loaded.
   * Typically, configurations will be read from files on the disk, but they could very well be loaded using other
   * means (e.g. environment variables, remote files, etc).
   */
  sourceType: string;

  /**
   * An identifier for the source.
   * For a file configuration, this is simply the path to the file.
   */
  source: string | null;

  /**
   * The actual configuration obtained from the source.
   */
  configuration: PartialConfiguration<T>;
};

/**
 * Options for the {@link ConfigurationReader} constructor.
 * Also contains private options that are not exposed in the actual constructor.
 */
type ConfigurationReaderOptions<T extends object> = {
  /**
   * The key indicating that an object should be evaluated as a template.
   */
  templateKey?: string;

  /**
   * The actual configuration to store in the reader.
   * Setting this bypasses the construction of the configuration from raw configurations.
   * This is a private option used by methods returning a copy of a configuration reader.
   */
  configuration?: T;
};

/**
 * Merges several configurations together.
 * All input configurations are copied and not mutated. Arrays in the objects are concatenated.
 *
 * @param rawConfigurations The raw configurations to merge together, and optionally with `configuration`.
 * @param configuration An existing configuration serving as base for the merge. Default to an empty object.
 * @returns The merged configurations.
 */
function mergeRawConfiguration<T extends object>(
  rawConfigurations: RawConfiguration<T>[],
  configuration: T = {} as any,
): T {
  return rawConfigurations.reduce(
    (conf, rawConfiguration) =>
      mergeWith(
        conf,
        cloneDeep(rawConfiguration.configuration),
        (objValue: any, srcValue: any) => {
          if (isArray(objValue)) {
            return objValue.concat(srcValue);
          }
        },
      ),
    cloneDeep(configuration),
  );
}

/**
 * An object constructing a configuration from several sources, possibly containing formatting (templates) referencing
 * other configuration values or evaluating arbitrary functions (data fetchers).
 *
 * @example
 * ```typescript
 * const reader = new ConfigurationReader<any>([{
 *    sourceType: ConfigurationReaderSourceType.File,
 *    source: 'some-file.json',
 *    configuration: {
 *      setting1: 'first value',
 *    },
 * }])
 *
 * const reader2 = reader.mergedWith({
 *    sourceType: ConfigurationReaderSourceType.File,
 *    source: 'some-other-file.json',
 *    configuration: {
 *      setting2: { $format: "${ configuration('setting1') } with prefix" }
 *    },
 * })
 *
 * await reader.getAndRender({}, 'setting2'); // 'first value with prefix'
 * ```
 */
export class ConfigurationReader<T extends object> {
  /**
   * The key indicating that an object should be evaluated as a template.
   */
  readonly templateKey: string;

  /**
   * The entire unified configuration.
   */
  private readonly configuration: T;

  /**
   * Creates a new reader from the given list of configurations.
   * Those configurations could have been obtained from files or other custom sources.
   *
   * @param rawConfigurations The list of {@link RawConfiguration}s that should be merged to obtain the full
   *   configuration.
   * @param options Additional options when creating the configuration reader.
   */
  constructor(
    readonly rawConfigurations: RawConfiguration<T>[],
    options: Omit<ConfigurationReaderOptions<T>, 'configuration'> = {},
  ) {
    this.templateKey = options.templateKey ?? DEFAULT_TEMPLATE_KEY;

    this.configuration =
      (options as ConfigurationReaderOptions<T>).configuration ??
      mergeRawConfiguration(rawConfigurations);
  }

  /**
   * Returns a copy of this configuration, merged with the given {@link RawConfiguration}s appended to it.
   *
   * @param rawConfigurations The raw configurations to append to this configuration.
   * @returns The merged configuration.
   */
  mergedWith(
    ...rawConfigurations: RawConfiguration<T>[]
  ): ConfigurationReader<T> {
    return new ConfigurationReader(
      [...this.rawConfigurations, ...rawConfigurations],
      {
        templateKey: this.templateKey,
        configuration: mergeRawConfiguration(
          rawConfigurations,
          this.configuration,
        ),
      } as ConfigurationReaderOptions<T>,
    );
  }

  /**
   * Returns the full configuration.
   * This throws an {@link UnformattedTemplateValueError} if the returned configuration contains formatting / rendering
   * instructions. To ensure those are processed, call {@link ConfigurationReader.getAndRender} instead.
   *
   * @param options Optional options for the get operation.
   * @returns The configuration.
   */
  get(options?: ConfigurationGetOptions): T;

  /**
   * Returns the value at a given path in the configuration object.
   * This throws an {@link UnformattedTemplateValueError} if the returned configuration contains formatting / rendering
   * instructions. To ensure those are processed, call {@link ConfigurationReader.getAndRender} instead.
   *
   * @param path The path to the value in the configuration object.
   * @param options Optional options for the get operation.
   * @returns The value, or `undefined` if the path does not exist.
   */
  get<TPath extends string>(
    path: TPath,
    options?: ConfigurationGetOptions,
  ): GetFieldType<T, TPath>;

  get(
    pathOrOptions?: string | ConfigurationGetOptions,
    options?: ConfigurationGetOptions,
  ): any {
    let path: string | undefined;

    if (typeof pathOrOptions === 'string') {
      path = pathOrOptions;
      options ??= {};
    } else if (typeof pathOrOptions === 'object') {
      options = pathOrOptions ?? {};
    }

    const value = this.unsafeGet(path);

    if (
      !options?.unsafe &&
      AsyncTemplateRenderer.containsRenderingObject(this.templateKey, value)
    ) {
      throw new UnformattedTemplateValueError(path ?? '.');
    }

    return value;
  }

  /**
   * Returns the value at a given path in the configuration object.
   * This method does not check whether the value contains formatting / rendering instructions.
   *
   * @param path The path to the value in the configuration object.
   *   If `undefined`, the entire configuration object is returned.
   * @returns The value, or `undefined` if the path does not exist.
   */
  private unsafeGet(path?: string): any {
    if (path == null) {
      return this.configuration;
    }

    return get(this.configuration, path);
  }

  /**
   * Returns the value at a given path in the configuration object, or throws an error if the path does not exist.
   *
   * @param path The path to the value in the configuration object.
   * @param options Optional options for the get operation.
   * @returns The value in the configuration.
   */
  getOrThrow<TPath extends string>(
    path: TPath,
    options?: ConfigurationGetOptions,
  ): Exclude<GetFieldType<T, TPath>, undefined> {
    const value = this.get(path, options);
    if (value === undefined) {
      throw new ConfigurationValueNotFoundError(path);
    }

    return value as any;
  }

  /**
   * Renders the entire configuration by recursively walking the object and processing templates.
   *
   * @param dataFetchers The data fetches to use for rendering.
   * @returns The entire configuration after rendering.
   */
  getAndRender(dataFetchers: DataFetchers): Promise<T>;

  /**
   * Renders the value at a given path in the configuration object, by recursively walking the value and processing
   * templates.
   * The `configuration` data fetcher is provided by default, which means that a template can reference another value in
   * the configuration:
   *
   * ```json
   * {
   *   "key1": "value1",
   *   "key2": { "$format": "${ configuration('key1') }" }
   * }
   * ```
   *
   * The `configuration` data fetcher will check for circular references in templates. Additional asynchronous
   * {@link DataFetchers} can be provided.
   *
   * @param dataFetchers The data fetchers to use for rendering.
   * @param path The path to the value in the configuration object.
   * @returns The value after rendering.
   */
  getAndRender<TPath extends string>(
    dataFetchers: DataFetchers,
    path: TPath,
  ): Promise<GetFieldType<T, TPath>>;

  async getAndRender(dataFetchers: DataFetchers, path?: string): Promise<any> {
    return await this.getAndRenderWithStack(dataFetchers, path, []);
  }

  /**
   * Renders the value at a given path in the configuration object, by recursively walking the value and processing
   * templates. If the value does not exist in the configuration, this throws an error instead of returning `undefined`.
   * See {@link ConfigurationReader.getAndRender} for more information about rendering.
   *
   * @param dataFetchers The data fetchers to use for rendering.
   * @param path The path to the value in the configuration object.
   * @returns The value after rendering.
   */
  async getAndRenderOrThrow<TPath extends string>(
    dataFetchers: DataFetchers,
    path: TPath,
  ): Promise<Exclude<GetFieldType<T, TPath>, undefined>> {
    const value = await this.getAndRender(dataFetchers, path);
    if (value === undefined) {
      throw new ConfigurationValueNotFoundError(path);
    }

    return value as any;
  }

  /**
   * This recursively renders the configuration or one of its child objects.
   * This method checks for circular references in templates within the configuration, when accessed using the
   * builtin `configuration` fetcher.
   *
   * @param dataFetchers The data fetchers to use for rendering.
   * @param path The path to the value in the configuration object, or `undefined` to process the entire configuration.
   * @param pathStack The list of paths in the configuration for which a rendering has occurred.
   * @returns The value after rendering.
   */
  private async getAndRenderWithStack(
    dataFetchers: DataFetchers,
    path: string | undefined,
    pathStack: string[],
  ): Promise<any> {
    const value = this.unsafeGet(path);

    const renderer = new AsyncTemplateRenderer(this.templateKey, {
      ...dataFetchers,
      configuration: (path: string) => {
        if (pathStack.some((p) => path.startsWith(p))) {
          throw new CircularTemplateReferenceError(path);
        }

        return this.getAndRenderWithStack(dataFetchers, path, [
          ...pathStack,
          path,
        ]);
      },
    });

    return await renderer.render(value);
  }
}
