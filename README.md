# Causa Workspace package

This is the repository for the `@causa/workspace` npm package. The main way to access Causa workspace functionalities is through the [Causa CLI](https://github.com/causa-io/cli). For more information about CLI features and how to configure a Causa workspace, look at the [CLI documentation](https://github.com/causa-io/cli#readme).

This document is addressed to Causa module developers, who need more information about the internals of the Causa workspace API.

## Configuration

The [`configuration`](./src/configuration/) folder exposes the `ConfigurationReader`, which implements a generic way of loading a YAML / JSON configuration from several files. It also provides a rendering API, to format configuration values from other configuration values or using custom functions.

## Workspace context

The [`context`](./src/context/) folder exposes the main part of the workspace API, namely the `WorkspaceContext`. It is the entrypoint for most workspace operations, as it initializes the configuration and function registry, and loads the Causa modules.

## Function registry

The [`function-registry`](./src/function-registry/) folder exposes the `FunctionRegistry`, which is how function definitions and implementations are registered, as well as called. The `FunctionRegistry` is parameterized with a context object, which for `WorkspaceContext.functionRegistry` is the `WorkspaceContext` itself.

## Service cache

The [`service-cache`](./src/service-cache/) exposes the simple `ServiceCache`, allowing to register singleton services within a `WorkspaceContext`.

## Testing

The [`testing`](./src/testing/) folder exposes testing utilities.

The `createContext` function allows creating a `WorkspaceContext` without loading a configuration from the disk. This is useful when "mocking" a context to test a workspace function.

The `registerMockFunction` registers a mock implementation of the given workspace function definition, returning a spy that can be used to assert calls made to the function.
