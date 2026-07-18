# Codex Bumper

<p align="center">
  <img src="resources/codex-bumper.png" alt="Codex Bumper extension logo" width="160">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=mparasha.codex-bumper">Visual Studio Marketplace</a>
  |
  <a href="https://open-vsx.org/extension/mparasha/codex-bumper">Open VSX Registry</a>
  |
  <a href="https://github.com/MPARASHA/codex-bumper/releases/latest">Latest VSIX</a>
</p>

Codex Bumper is an unofficial VS Code and Antigravity extension for people who rely on local Codex chat history and occasionally lose precious context because an older chat falls out of the visible recent list.

Codex may keep older saved sessions locally while only showing a recent subset in the picker or app history. When that happens, a chat can feel missing even though the conversation file is still in `~/.codex/sessions`. Codex Bumper gives you a small browser for those local chats and a one-click bump button that says `hi` to the selected chat, updates its local history metadata, and moves it back into recent history.

## What It Does

- Shows local Codex chats from `~/.codex/session_index.jsonl` and `~/.codex/sessions`.
- Recovers missing chat names from the saved thread name or first user message.
- Opens a readable transcript for a selected chat.
- Adds a **Bump: say hi** action for each chat.
- Bumping writes a tiny `hi` user turn plus assistant reply into the saved session file.
- Bumping updates both the legacy `session_index.jsonl` index and the current Codex SQLite recency metadata.
- Bumping opens and refreshes the Codex sidebar so the reordered history appears without restarting Codex.
- Works for default Codex installs and lets users override the Codex home path.

## Why This Exists

Some Codex conversations contain hard-won debugging context: a VM recovery, a payer investigation, an EOB fetch flow, a long code review, or an exact sequence of decisions. If the chat is not visible in the latest history window, finding it manually is slow. This extension is for bringing that context back to the surface without hand-editing JSONL files.

## Install

Codex Bumper is published in both major VS Code extension registries:

| Editor | Registry | Install |
| --- | --- | --- |
| Antigravity | [Open VSX](https://open-vsx.org/extension/mparasha/codex-bumper) | Open **Extensions**, search for `Codex Bumper`, and select **Install**. |
| Visual Studio Code | [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=mparasha.codex-bumper) | Open **Extensions**, search for `Codex Bumper`, and select **Install**. |
| Other VS Code-compatible editors | Open VSX or VSIX | Use the editor's extension search or install the [latest VSIX](https://github.com/MPARASHA/codex-bumper/releases/latest). |

Antigravity uses Open VSX as its extension registry, so the Open VSX listing is the normal install and update path for Antigravity users. Registry installations can receive new Codex Bumper versions through the editor's usual extension update mechanism.

VS Code users can also install it from a terminal:

```bash
code --install-extension mparasha.codex-bumper
```

## Requirements

- VS Code 1.107+, Antigravity, or another compatible IDE on macOS, Linux, or Windows.
- Codex installed locally.
- Local Codex history stored under `~/.codex`, or a custom path configured with `codexBumper.codexHome`.

For WSL, containers, and remote workspaces, Codex Bumper must run where the Codex history files are visible. Set `codexBumper.codexHome` to that environment's Codex home when it differs from the default.

## Usage

1. Open the **Codex Bumper** activity bar view.
2. Select a chat to view its transcript.
3. Click **Bump: say hi** from the transcript header or the chat row context action.
4. Codex Bumper opens and refreshes the Codex sidebar. The bumped chat should appear near the top.

The automatic refresh uses the editor's built-in **Reload Webviews** action. It does not restart the extension host or the Codex app-server process.

## Settings

- `codexBumper.codexHome`: optional override for the Codex home directory. Defaults to `~/.codex`.
- `codexBumper.sqliteHome`: optional override for the directory containing `state_5.sqlite`. Defaults to `CODEX_SQLITE_HOME`, then the Codex home directory.
- `codexBumper.bumpAssistantReply`: reply text written with the bump turn. Defaults to `Hi. I'm here.`

## Safety Notes

Codex Bumper only edits local Codex history files:

- `session_index.jsonl`
- matching `sessions/**/*.jsonl`
- `state_5.sqlite` history timestamps for the matching thread

It does not call Codex models, send network requests, read workspace source files, or modify any project repository.

Using the extension does not create model or API charges. Codex's local history format can change between releases, so a future Codex update may require a matching Codex Bumper update.

## Development

```bash
npm install
npm run compile
npm run package
```

The generated `.vsix` can be installed into Antigravity with:

```bash
antigravity --install-extension codex-bumper-0.1.3.vsix
```

Publishing a GitHub release runs the repository's publish workflow for both Visual Studio Marketplace and Open VSX. An ordinary push to GitHub does not publish a marketplace update.

## License

MIT
