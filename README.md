# sudokupad-replay-tools

An unofficial, local-only parser for SudokuPad `.replay` files, with a small command-line interface and a read-only MCP server.

It turns SudokuPad's compact `replay_v1.0` + `clzw` action stream into deterministic events: timestamps, selected cells, before/after cell state, solution mismatches, and undo/redo links. Pure selection events are hidden from normal queries unless requested, so an agent does not have to ingest hundreds of low-value clicks.

> Status: experimental v0.1.0. Tested against the included synthetic fixtures and one private 1,185-action SudokuPad replay. This project is not affiliated with or endorsed by SudokuPad.

## What it does

- Validates and decodes local `replay_v1.0` / `clzw` files.
- Reconstructs values, centre marks, corner marks, colours, pen marks, selection, undo, and redo.
- Preserves every decoded action and its timing; it does not silently discard unknown action codes.
- Queries a concise, paginated event timeline; selection-only events are off by default.
- Reconstructs the complete grid after an action or at a replay time.
- Compares entered values with the embedded solution when one exists.

It intentionally does **not** provide a web UI, visual player, AI inference, performance metrics, or `.progress`/zip import in v0.1.0.

## Requirements and setup

- Node.js 20 or newer
- npm

```sh
npm install
npm run check
```

The build output is written to `dist/`.

## Command line

```sh
node dist/src/cli.js inspect /path/to/puzzle.replay
node dist/src/cli.js events /path/to/puzzle.replay --type vl,ud,rd --limit 50
node dist/src/cli.js events /path/to/puzzle.replay --cell r8c8 --include-selection
node dist/src/cli.js events /path/to/puzzle.replay --mismatch-only
node dist/src/cli.js state /path/to/puzzle.replay --action 364
node dist/src/cli.js state /path/to/puzzle.replay --time-ms 600000
```

All output is JSON. Errors are also JSON and include a stable error code. `--action N` means the state after action N; action 0 is the initial state.

## MCP server

Start the stdio server with:

```sh
npm run start:mcp
```

Or configure any MCP client to launch Node with the absolute path to `dist/src/mcp.js`. A typical stdio entry looks like this (the surrounding configuration format varies by client):

```json
{
  "command": "node",
  "args": ["C:/absolute/path/to/sudokupad-replay-tools/dist/src/mcp.js"]
}
```

The server exposes three read-only tools:

- `inspect_replay`: metadata, warnings, counts, duration, and final solution check.
- `query_events`: filtered, paginated events with state changes and undo/redo links. It hides `hl`, `sl`, and `ds` selection actions by default.
- `get_state`: full state after a given action index or at a replay time.

Example agent request: “Inspect this replay, then show value entries and undo/redo events around the first solution mismatch.”

## Compatibility and failure policy

The format contract is the container's `replay_v1.0` plus replay compression type `clzw`; the SudokuPad application version is **not** a strict allow-list. An untested app version produces a warning. Unknown container formats, compression methods, malformed coordinates, or unknown action codes fail explicitly with diagnostics and the last reliable action position where applicable.

Current and legacy action-code tables observed in SudokuPad are supported. Because `.replay` is not presented here as a stable public specification, new SudokuPad releases may require updates.

Input limits protect machine-facing use: regular files only, 8 MiB compressed file size, 32 MiB per decompressed payload, 250,000 actions, bounded JSON depth, and grid/coordinate checks. Limits are defined in `src/limits.ts`.

## Privacy

Replay files can reveal puzzle titles, solving behaviour, timings, mistakes, and pauses. The parser and MCP server read only the local path explicitly supplied to a command/tool and do not make network requests or modify the replay. They return decoded content to the calling terminal or MCP client, so that client's own privacy rules still apply.

Real user replays are ignored by Git. The committed fixtures under `test/fixtures/` are synthetic and contain no user replay data.

## Private golden test

The public test suite uses synthetic fixtures. Maintainers can additionally validate a private replay without copying it into the repository:

```sh
SUDOKUPAD_GOLDEN_REPLAY=/absolute/path/to/private.replay npm test
```

PowerShell:

```powershell
$env:SUDOKUPAD_GOLDEN_REPLAY = 'C:\absolute\path\to\private.replay'
npm test
```

## License and attribution

Project code is licensed under the MIT License. The bounded LZ-String-compatible decompressor in `src/lz-string-compat.ts` is adapted from LZ-String; see `THIRD_PARTY_NOTICES.md`.

## 中文速览

这是一个非官方、本地运行的 SudokuPad `.replay` 解析工具。命令行适合直接检查，MCP 适合让模型按需查询。底层仍保留全部动作；默认查询只隐藏纯选格/取消选格，随时可以用 `includeSelection` 或 `--include-selection` 取回。真实回放不会自动上传，也不会作为测试样例提交到 Git。
