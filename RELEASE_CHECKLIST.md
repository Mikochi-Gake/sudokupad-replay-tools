# v0.1.0 release checklist

- [x] Deterministic `replay_v1.0` + `clzw` parser
- [x] Unknown app version warns rather than blocks
- [x] Unknown action fails explicitly with raw diagnostics
- [x] File, decompression, JSON-depth, grid, coordinate, and action-count limits
- [x] CLI inspect/events/state smoke test
- [x] MCP process startup and tool-call integration test
- [x] Public fixtures are synthetic
- [x] Private 1,185-action golden replay passes without entering the repository
- [x] Final golden state matches the embedded solution
- [x] MIT license and LZ-String attribution
- [x] Replay and environment-file ignore rules
- [ ] Confirm the desired GitHub owner/name
- [ ] Create the empty public GitHub repository
- [ ] Add the remote and inspect the exact outgoing commit
- [ ] Push only after the final secret/large-file/privacy scan
- [ ] Optionally enable GitHub private vulnerability reporting

Not in v0.1.0: web UI, visual player, `.progress`/zip support, performance metrics, or AI reasoning.
