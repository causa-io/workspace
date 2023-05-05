# 🔖 Changelog

## Unreleased

Breaking changes:

- Processors are no longer loaded from the configuration by default. Instead, they should be passed to `WorkspaceContext.init()` or `WorkspaceContext.clone()`.

## v0.1.1 (2023-05-04)

Fixes:

- Fix incorrect package exports.

## v0.1.0 (2023-05-04)

Features:

- The first version of the @causa/workspace package, implementing the `WorkspaceContext`.
