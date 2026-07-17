# Publishing

## GitHub

The repository is public at:

https://github.com/MPARASHA/codex-bumper

Create a new release after bumping `package.json`:

```bash
npm run compile
npm run package
gh release create vX.Y.Z codex-bumper-X.Y.Z.vsix --title "Codex Bumper X.Y.Z" --notes "Release notes"
```

## Visual Studio Marketplace

Publishing to the Visual Studio Marketplace requires a publisher account and a Personal Access Token that has access to that publisher:

https://marketplace.visualstudio.com/manage/publishers/

The current package uses publisher id `mparasha`, so the PAT must be authorized for that Marketplace publisher.

### GitHub Actions

Add the token as a repository secret named `VSCE_PAT`. A normal code push does not publish an extension; the **Publish Extension** workflow runs manually or whenever a new GitHub release is published.

### Local Publish

After setting the token locally:

```bash
export VSCE_PAT="..."
npx vsce publish -i codex-bumper-X.Y.Z.vsix --skip-duplicate
```

## Open VSX

Sign in at https://open-vsx.org, connect an Eclipse account, accept the Publisher Agreement, and create an access token. The package publisher is `mparasha`, so the same namespace must exist on Open VSX.

Add the token as a repository secret named `OVSX_PAT`. The same GitHub workflow publishes the packaged VSIX to Open VSX after publishing it to the Visual Studio Marketplace.

For a local publish:

```bash
export OVSX_PAT="..."
npx --yes ovsx@1.0.2 publish codex-bumper-X.Y.Z.vsix --pat "$OVSX_PAT" --skip-duplicate
```
