# 🔖 Changelog

## Unreleased

Chore:

- Set up Causa for the repository.
- Upgrade dependencies.

## v0.12.0 (2023-07-24)

Features:

- Make `WorkspaceContext.get[AndRender]()` accept no argument to retrieve the entire configuration.

## v0.11.0 (2023-07-24)

Features:

- Implement the `WorkspaceContext.listProjectPaths` utility.
- Support the `null` value for `processors` when cloning a context, removing all processors.

## v0.10.0 (2023-06-09)

Features:

- Define the `project.additionalDirectories` configuration field.
- Implement the `WorkspaceContext.getProjectAdditionalDirectories` utility.

## v0.9.0 (2023-06-07)

Breaking changes:

- Refactor module loading errors for easier catching by the CLI.

## v0.8.0 (2023-06-07)

Breaking changes:

- Remove the `isModuleLocalPath` utility.
- Support local paths for modules the npm way, i.e. specify `file:<path>` as the version.

Features:

- Move the `setUpCausaFolder` from the `@causa/cli` package to this package.
- Specify the `IncompatibleModuleVersionError` to ease version errors detection, even across worker threads.

## v0.7.0 (2023-05-22)

Features:

- Expose the `loadWorkspaceConfiguration` function, to load a configuration without creating a context.
- Implement the `isModuleLocalPath` utility, exposing how the module loading logic makes the difference with valid npm package names.

## v0.6.0 (2023-05-19)

Fixes:

- Use the correct base path when resolving package paths. This would cause module import to fail.

Breaking changes:

- Rename `ProcessorOutput` to `ProcessorResult` for consistency with existing functions.

## v0.5.0 (2023-05-19)

Breaking changes:

- Processors should return an object containing a `configuration` property, rather than the configuration directly. The `ProcessorFunction` can be implemented to ensure a workspace function is a valid processor.

## v0.4.0 (2023-05-15)

Features:

- Implement the `listFilesAndFormat` file utility.

Fixes:

- Depend on `lodash` types to correctly export `GetFieldType`.

## v0.3.0 (2023-05-15)

Breaking changes:

- Function implementations (class constructors) must conform to the `ImplementableFunctionImplementationConstructor` type rather than `ClassConstructor` from the `class-transformer` package.

Features:

- Provide the `createContext` and `registerMockFunction` testing utilities.

## v0.2.1 (2023-05-05)

Fixes:

- Export `ProcessorInstruction`.

## v0.2.0 (2023-05-05)

Breaking changes:

- Processors are no longer loaded from the configuration by default. Instead, they should be passed to `WorkspaceContext.init()` or `WorkspaceContext.clone()`.
- Module dependencies in the configuration are now defined as a dictionary, and relative paths are resolved from the workspace root. For regular (non-path like) modules, the `semver` is checked.

## v0.1.1 (2023-05-04)

Fixes:

- Fix incorrect package exports.

## v0.1.0 (2023-05-04)

Features:

- The first version of the @causa/workspace package, implementing the `WorkspaceContext`.
