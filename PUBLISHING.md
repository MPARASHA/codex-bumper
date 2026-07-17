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

Add the token as a repository secret named `VSCE_PAT`, then run the **Publish Extension** workflow from GitHub Actions. The workflow also runs whenever a new GitHub release is published.

### Local Publish

After setting the token locally:

```bash
export VSCE_PAT="..."
npx vsce publish -i codex-bumper-0.1.0.vsix --skip-duplicate
```
