# Changelog

## 0.1.4

- Stop force-reloading editor webviews after a bump because it can restart or destabilize Codex in Antigravity.
- Continue opening the Codex sidebar while leaving history refresh to Codex's supported lifecycle.

## 0.1.3

- Attempt to refresh Codex history automatically by running the editor's Reload Webviews action after a successful bump.

## 0.1.2

- Update Codex's SQLite recency metadata so bumped chats actually return to the top of current history views.
- Write the current Codex turn-start event alongside the synthetic `hi` turn.
- Add a configurable SQLite home for non-default Codex state locations.

## 0.1.1

- Infer missing chat names from saved thread-name events or the first user message.
- Limit title discovery to the beginning of untitled sessions so large histories stay responsive.
- Expand configured home paths consistently on macOS, Linux, and Windows.
- Add new Marketplace and Activity Bar artwork.

## 0.1.0

- Initial public release.
- Browse local Codex chats.
- View conversation transcripts.
- Bump chats by writing a `hi` turn and updating the local Codex history index.
