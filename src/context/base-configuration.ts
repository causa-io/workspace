/**
 * The schema for core elements of the configuration.
 */
export type BaseConfiguration = {
  /**
   * The version number for the used configuration schema.
   */
  version: number;

  /**
   * Information about the workspace.
   * The file defining `workspace.name` should be located at the root of the workspace.
   * Its location will be used to determine the root path.
   */
  workspace: {
    /**
     * The name of the workspace.
     * Depending of the size, it could be the name of the company, or the overarching project.
     */
    name: string;

    /**
     * A description for the workspace.
     */
    description?: string;
  };

  /**
   * Information about the project within the workspace.
   * The file defining `project.name` should be located at the root of the project.
   * Its location will be used to determine the project path.
   */
  project?: {
    /**
     * The name of the project.
     */
    name: string;

    /**
     * The type of project.
     */
    type: string;

    /**
     * The programming language for the project.
     */
    language: string;
  };

  /**
   * Configuration for the CLI itself.
   */
  causa?: {
    /**
     * The list of modules to load when the CLI runs.
     */
    modules?: string[];

    /**
     * Generic configuration for secrets.
     */
    secrets?: {
      /**
       * The ID of the default backend to use when fetching secrets, if none is specified.
       */
      defaultBackend?: string;
    };
  };

  /**
   * A map where keys are secret IDs and values are the corresponding configurations.
   * The configuration may contain fields that are specific to the referenced backend.
   */
  secrets?: Record<
    string,
    {
      /**
       * The ID of the backend to use when fetching the secret.
       * Defaults to `causa.secrets.defaultBackend`.
       */
      backend?: string;

      [key: string]: any;
    }
  >;

  /**
   * A map where keys are environment IDs and values provide details about each environment.
   */
  environments?: Record<
    string,
    {
      /**
       * The full displayable name for the environment.
       */
      name: string;

      /**
       * Additional configuration that will be merged with the main one before running operations against the
       * environment.
       */
      configuration?: Record<string, any>;
    }
  >;

  /**
   * A list of processors to run before any operation.
   */
  processors?: {
    /**
     * The name of the processor to run.
     */
    name: string;

    /**
     * Arguments to pass to the processor.
     */
    args?: Record<string, any>;
  }[];
};
