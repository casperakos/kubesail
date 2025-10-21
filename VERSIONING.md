# Versioning Guide for KubeSail

## Overview

KubeSail uses **Semantic Versioning (SemVer)** for all releases. The version is managed in a single source of truth and automatically displayed throughout the application.

## Versioning Scheme

We follow [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

- **MAJOR** (X.0.0): Incompatible API changes, major redesigns, breaking changes
- **MINOR** (0.X.0): New features, backwards-compatible functionality
- **PATCH** (0.0.X): Bug fixes, backwards-compatible bug fixes

### Examples

- `0.1.0` → Initial development release
- `0.2.0` → Added new feature (e.g., new resource type support)
- `0.2.1` → Fixed a bug in the new feature
- `1.0.0` → First stable release
- `1.1.0` → Added Helm support
- `1.1.1` → Fixed Helm chart parsing bug
- `2.0.0` → Major UI overhaul with breaking configuration changes

## Version Source of Truth

The version is defined in **two places** that must always match:

### 1. `package.json`
```json
{
  "version": "0.1.0"
}
```

### 2. `src-tauri/tauri.conf.json`
```json
{
  "version": "0.1.0"
}
```

**Important**: Both files MUST have the same version number. The app reads from `tauri.conf.json` at runtime.

## How Version is Displayed

The version is automatically displayed in the **sidebar footer** of the application:

- Location: `src/components/Sidebar.tsx`
- Implementation: Uses Tauri's `getVersion()` API
- Display format: `v{version} • {year}` (e.g., "v0.1.0 • 2025")

```tsx
import { getVersion } from "@tauri-apps/api/app";

// Fetches version from tauri.conf.json at runtime
useEffect(() => {
  getVersion().then(version => setAppVersion(version));
}, []);
```

## How to Release a New Version

### Step 1: Update Version Numbers

Update both version files to the new version:

**package.json:**
```bash
# Option 1: Use npm version command (recommended)
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.0 → 0.2.0
npm version major   # 0.1.0 → 1.0.0

# Option 2: Manual edit
# Edit package.json and change "version": "0.1.0" to desired version
```

**src-tauri/tauri.conf.json:**
```bash
# Manual edit required - update the version field
# "version": "0.2.0"
```

### Step 2: Commit Version Bump

```bash
git add package.json src-tauri/tauri.conf.json
git commit -m "Bump version to v0.2.0"
git push origin master
```

### Step 3: Create Git Tag

Tags trigger the automated build and release workflow:

```bash
# Create annotated tag
git tag -a v0.2.0 -m "Release v0.2.0: Description of changes"

# Push tag to GitHub
git push origin v0.2.0
```

### Step 4: GitHub Actions Builds

Once the tag is pushed, GitHub Actions automatically:

1. ✅ Detects the tag push
2. ✅ Builds for all platforms (macOS ARM/Intel, Linux, Windows)
3. ✅ Creates installers (.dmg, .deb, .AppImage, .rpm, .msi, .exe)
4. ✅ Creates a **draft release** on GitHub
5. ✅ Attaches all build artifacts to the release

### Step 5: Publish Release

1. Go to https://github.com/casperakos/kubesail/releases
2. Find the draft release for your version
3. Edit the release notes:
   - Add changelog
   - Highlight new features
   - List bug fixes
   - Add any breaking changes
4. Click **Publish release**

## Version Workflow Summary

```bash
# 1. Decide version bump (patch/minor/major)
npm version minor  # Creates 0.2.0

# 2. Manually update src-tauri/tauri.conf.json
# Change "version": "0.2.0"

# 3. Commit
git add package.json src-tauri/tauri.conf.json
git commit -m "Bump version to v0.2.0"
git push origin master

# 4. Create and push tag
git tag -a v0.2.0 -m "Release v0.2.0: Added Helm support"
git push origin v0.2.0

# 5. Wait for GitHub Actions to build (10-15 minutes)

# 6. Publish the draft release on GitHub
```

## Pre-release Versions

For beta/alpha releases, use pre-release identifiers:

```
0.2.0-alpha.1    # First alpha
0.2.0-alpha.2    # Second alpha
0.2.0-beta.1     # First beta
0.2.0-rc.1       # Release candidate
0.2.0            # Stable release
```

Mark pre-releases on GitHub with the "This is a pre-release" checkbox.

## Development Builds

Development builds (from commits without tags) are not versioned as releases:

- They use the current version from `tauri.conf.json`
- Artifacts are uploaded to GitHub Actions (not releases)
- Available for testing but not for distribution

## Checking Current Version

### In the App
Look at the **bottom of the sidebar** (when expanded) to see the current version.

### Via CLI
```bash
# From package.json
jq -r '.version' package.json

# From tauri.conf.json
jq -r '.version' src-tauri/tauri.conf.json

# From git tags
git describe --tags --abbrev=0
```

### Via GitHub API
```bash
# Get latest release version
curl -s https://api.github.com/repos/casperakos/kubesail/releases/latest | jq -r '.tag_name'
```

## Automated Build Workflow

The build workflow (`.github/workflows/build.yml`) is triggered by:

1. **Tag push** (e.g., `v0.2.0`) → Builds and creates draft release
2. **Push to master** → Builds and uploads artifacts (no release)
3. **Pull request** → Runs checks only (no builds)
4. **Manual trigger** → Builds via workflow dispatch

### Build Artifacts

Each release includes:

**macOS:**
- `kubesail_0.2.0_aarch64.dmg` (Apple Silicon)
- `kubesail_0.2.0_x64.dmg` (Intel)
- `.app` bundles for both

**Linux:**
- `kubesail_0.2.0_amd64.deb` (Debian/Ubuntu)
- `kubesail_0.2.0_amd64.AppImage` (Universal)
- `kubesail-0.2.0-1.x86_64.rpm` (Fedora/RHEL)

**Windows:**
- `kubesail_0.2.0_x64_en-US.msi` (MSI installer)
- `kubesail_0.2.0_x64-setup.exe` (NSIS installer)

## Troubleshooting

### Version doesn't show in sidebar
- Check that `src-tauri/tauri.conf.json` has the correct version
- Rebuild the app: `pnpm run tauri dev`
- Check browser console for errors

### npm version command doesn't update tauri.conf.json
- This is expected - you must manually update `src-tauri/tauri.conf.json`
- Always update both files to match

### GitHub Actions doesn't trigger
- Ensure tag follows format: `vX.Y.Z` (with `v` prefix)
- Check workflow is enabled: https://github.com/casperakos/kubesail/actions
- Verify tag was pushed: `git ls-remote --tags origin`

### Build fails with version mismatch
- Ensure `package.json` and `tauri.conf.json` versions match exactly
- Check for typos or extra characters

## Version History

Maintain a `CHANGELOG.md` file with version history:

```markdown
# Changelog

## [0.2.0] - 2025-01-20
### Added
- Helm releases support
- Port forwarding UI

### Fixed
- Pod logs not streaming correctly

## [0.1.0] - 2025-01-15
### Added
- Initial release
- Basic Kubernetes resource management
```

## References

- [Semantic Versioning](https://semver.org/)
- [Tauri Versioning Guide](https://tauri.app/v1/guides/distribution/versioning)
- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
