# 🔖 Changelog

## Unreleased

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
