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

After setting the token:

```bash
export VSCE_PAT="..."
npx vsce publish -i codex-bumper-0.1.0.vsix --skip-duplicate
```

The current package uses publisher id `mparasha`, so the PAT must be authorized for that Marketplace publisher.
