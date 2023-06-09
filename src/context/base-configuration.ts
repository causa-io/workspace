/**
 * The schema for core elements of the configuration.
 */
export type BaseConfiguration = {
  /**
   * The version number for the used configuration schema.
   */
  readonly version: number;

  /**
   * Information about the workspace.
   * The file defining `workspace.name` should be located at the root of the workspace.
   * Its location will be used to determine the root path.
   */
  readonly workspace: {
    /**
     * The name of the workspace.
     * Depending of the size, it could be the name of the company, or the overarching project.
     */
    readonly name: string;

    /**
     * A description for the workspace.
     */
    readonly description?: string;
  };

  /**
   * Information about the project within the workspace.
   * The file defining `project.name` should be located at the root of the project.
   * Its location will be used to determine the project path.
   */
  readonly project?: {
    /**
     * The name of the project.
     */
    readonly name: string;

    /**
     * The type of project.
     */
    readonly type: string;

    /**
     * The programming language for the project.
     */
    readonly language: string;

    /**
     * A list of glob patterns, relative to the **workspace** root, that match directories that are also part of the
     * project.
     * This is only needed for directories that are not part of the project root. This is a hint to various processes
     * (e.g. the continuous integration) that they should also consider these directories when running operations
     * against the project.
     */
    readonly additionalDirectories?: string[];
  };

  /**
   * Configuration for the CLI itself.
   */
  readonly causa?: {
    /**
     * The modules to load when the CLI runs.
     * Keys are the names of the modules (npm packages) and values are `semver` versions.
     * Local paths are also accepted. Relative paths will be resolved from the workspace root.
     */
    readonly modules?: Record<string, string>;

    /**
     * Generic configuration for secrets.
     */
    readonly secrets?: {
      /**
       * The ID of the default backend to use when fetching secrets, if none is specified.
       */
      readonly defaultBackend?: string;
    };
  };

  /**
   * A map where keys are secret IDs and values are the corresponding configurations.
   * The configuration may contain fields that are specific to the referenced backend.
   */
  readonly secrets?: Record<
    string,
    {
      /**
       * The ID of the backend to use when fetching the secret.
       * Defaults to `causa.secrets.defaultBackend`.
       */
      readonly backend?: string;

      readonly [key: string]: any;
    }
  >;

  /**
   * A map where keys are environment IDs and values provide details about each environment.
   */
  readonly environments?: Record<
    string,
    {
      /**
       * The full displayable name for the environment.
       */
      readonly name: string;

      /**
       * Additional configuration that will be merged with the main one before running operations against the
       * environment.
       */
      readonly configuration?: Record<string, any>;
    }
  >;
};
