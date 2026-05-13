# port-hunter-cli

Interactive terminal UI to list TCP listening ports (with project / command hints on macOS) and end listeners after confirmation. Works on macOS, Linux, and Windows.

## Install (global)

```bash
npm install -g port-hunter-cli
```

With pnpm:

```bash
pnpm add -g port-hunter-cli
```

## Usage

```bash
port-hunter          # mouse + keyboard TUI
port-hunter --once   # print table once, then exit
port-hunter --help
```

### TUI shortcuts

- **Mouse**: click a port row to start kill flow (two confirmation dialogs). Click the same row again also starts the flow.
- **Enter** (list focused): same as activating the row (kill flow).
- **Arrows / j k / wheel**: move highlight only (does not open kill dialog).
- **r** / **Refresh**: rescan ports.
- **q** / **Quit**: exit.
- **/** : focus filter; **Enter** / **Esc** from filter returns to list.

Kill uses **SIGTERM** (graceful) after both confirmations.

## Requirements

- Node.js **18+**
- Port discovery uses `lsof` / `ss` (Unix) or `netstat` (Windows). Process details on non-macOS Unix are best-effort compared to macOS.

## Publish (maintainers)

```bash
cd port-hunter-cli
npm login
npm publish --access public
```

Use `npm version patch|minor|major` before publishing when bumping versions.

## License

MIT — see [LICENSE](./LICENSE).
