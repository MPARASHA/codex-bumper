# Codex Bumper

Codex Bumper is an unofficial VS Code and Antigravity extension for people who rely on local Codex chat history and occasionally lose precious context because an older chat falls out of the visible recent list.

Codex may keep older saved sessions locally while only showing a recent subset in the picker or app history. When that happens, a chat can feel missing even though the conversation file is still in `~/.codex/sessions`. Codex Bumper gives you a small browser for those local chats and a one-click bump button that says `hi` to the selected chat and appends a fresh `session_index.jsonl` entry so the chat can move back into recent history.

## What It Does

- Shows local Codex chats from `~/.codex/session_index.jsonl` and `~/.codex/sessions`.
- Recovers missing chat names from the saved thread name or first user message.
- Opens a readable transcript for a selected chat.
- Adds a **Bump: say hi** action for each chat.
- Bumping writes a tiny `hi` user turn plus assistant reply into the saved session file.
- Bumping also appends a fresh row to `session_index.jsonl`, using the current timestamp.
- Works for default Codex installs and lets users override the Codex home path.

## Why This Exists

Some Codex conversations contain hard-won debugging context: a VM recovery, a payer investigation, an EOB fetch flow, a long code review, or an exact sequence of decisions. If the chat is not visible in the latest history window, finding it manually is slow. This extension is for bringing that context back to the surface without hand-editing JSONL files.

## Requirements

- VS Code, Antigravity, or another VS Code-compatible IDE on macOS, Linux, or Windows.
- Codex installed locally.
- Local Codex history stored under `~/.codex`, or a custom path configured with `codexBumper.codexHome`.

For WSL, containers, and remote workspaces, Codex Bumper must run where the Codex history files are visible. Set `codexBumper.codexHome` to that environment's Codex home when it differs from the default.

## Usage

1. Open the **Codex Bumper** activity bar view.
2. Select a chat to view its transcript.
3. Click **Bump: say hi** from the transcript header or the chat row context action.
4. Reopen or refresh Codex history. The bumped chat should appear near the top.

## Settings

- `codexBumper.codexHome`: optional override for the Codex home directory. Defaults to `~/.codex`.
- `codexBumper.bumpAssistantReply`: reply text written with the bump turn. Defaults to `Hi. I'm here.`

## Safety Notes

Codex Bumper only edits local Codex history files:

- `session_index.jsonl`
- matching `sessions/**/*.jsonl`

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
antigravity --install-extension codex-bumper-0.1.1.vsix
```

## License

MIT
