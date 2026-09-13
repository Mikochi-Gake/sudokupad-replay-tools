# Security and privacy

## Supported version

Security fixes currently target the latest commit on the default branch. This is experimental software and has no long-term support promise yet.

## Replay data

Treat replay files as potentially private. They may include puzzle metadata and detailed interaction timing. Do not attach a real replay to a public issue unless you intend to publish it. Prefer a minimal synthetic reproduction.

The CLI and MCP server are local, read-only utilities. They accept a caller-provided file path, enforce input/decompression/action limits, and do not initiate network requests. The surrounding MCP client may process returned data elsewhere; review that client's privacy policy separately.

## Reporting a vulnerability

Open a GitHub issue only when the report does not contain sensitive replay data. For a future repository with private vulnerability reporting enabled, prefer that channel for security-sensitive details.
