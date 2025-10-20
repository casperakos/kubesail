# GitHub Actions Workflows

This directory contains automated workflows for building and testing the KubeSail Tauri application.

## Workflows

### 1. Build and Release (`build.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch
- Release creation

**What it does:**
- Builds the application for all supported platforms:
  - macOS ARM64 (Apple Silicon)
  - macOS x64 (Intel)
  - Linux x64
  - Windows x64
- Creates installers for each platform:
  - **macOS**: `.dmg` and `.app` bundles
  - **Linux**: `.deb`, `.AppImage`, and `.rpm` packages
  - **Windows**: `.msi` and `.exe` installers
- Uploads build artifacts for non-release builds
- Creates draft releases when triggered by a release event

**Platforms Built:**
| Platform | Architecture | Runner | Artifacts |
|----------|-------------|--------|-----------|
| macOS | ARM64 (Apple Silicon) | `macos-latest` | `.dmg`, `.app` |
| macOS | x64 (Intel) | `macos-latest` | `.dmg`, `.app` |
| Linux | x64 | `ubuntu-22.04` | `.deb`, `.AppImage`, `.rpm` |
| Windows | x64 | `windows-latest` | `.msi`, `.exe` |

### 2. PR Check (`pr-check.yml`)

**Triggers:**
- Pull requests to `main` or `develop` branches

**What it does:**
- Quick validation checks on Linux only (faster than full builds)
- Runs TypeScript type checking
- Checks Rust code formatting (`cargo fmt`)
- Runs Rust linting (`cargo clippy`)
- Runs Rust tests
- Builds frontend and backend in debug mode

This workflow is designed to catch issues early without the overhead of building for all platforms.

## Setup Instructions

### Required Configuration

No additional configuration is required for basic builds. The workflows will work out of the box.

### Optional: Code Signing (Recommended for Production)

For signed releases, you need to configure the following GitHub Secrets:

#### macOS Code Signing

1. Generate a signing certificate in Xcode or Apple Developer Portal
2. Export the certificate as a `.p12` file
3. Convert to base64: `base64 -i certificate.p12 -o certificate.base64`
4. Add these secrets to your GitHub repository:
   - `APPLE_CERTIFICATE`: The base64-encoded certificate
   - `APPLE_CERTIFICATE_PASSWORD`: Password for the certificate
   - `APPLE_ID`: Your Apple ID email
   - `APPLE_PASSWORD`: App-specific password for your Apple ID
   - `APPLE_TEAM_ID`: Your Apple Developer Team ID

#### Windows Code Signing

1. Obtain a code signing certificate (e.g., from DigiCert, Sectigo)
2. Add these secrets to your GitHub repository:
   - `WINDOWS_CERTIFICATE`: Base64-encoded certificate
   - `WINDOWS_CERTIFICATE_PASSWORD`: Certificate password

#### Tauri Updater Signing (Optional)

For automatic app updates:

1. Generate signing keys:
   ```bash
   cd src-tauri
   cargo install tauri-cli
   cargo tauri signer generate
   ```

2. Add these secrets to your GitHub repository:
   - `TAURI_SIGNING_PRIVATE_KEY`: The private key from the generated keypair
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password for the private key

### Setting Up Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret with its corresponding value

## Manual Workflow Trigger

You can manually trigger the build workflow:

1. Go to the "Actions" tab in your GitHub repository
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Choose the branch and click "Run workflow"

## Creating a Release

To create a release with installers:

1. Create and push a new tag:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```

2. Go to GitHub → Releases → Create a new release
3. Select the tag you just created
4. The workflow will automatically:
   - Build for all platforms
   - Create installers
   - Attach them to the release as a draft
5. Review the draft release and publish when ready

## Viewing Build Artifacts

For non-release builds (e.g., commits to main):

1. Go to the "Actions" tab
2. Click on the workflow run
3. Scroll down to "Artifacts"
4. Download the artifacts for your platform:
   - `kubesail-macos-arm64`
   - `kubesail-macos-x64`
   - `kubesail-linux-x64`
   - `kubesail-windows-x64`

## Troubleshooting

### Build fails on specific platform

- Check the workflow logs for that specific job
- Ensure all dependencies are correctly specified
- Verify the platform-specific configuration in `tauri.conf.json`

### Code signing issues

- Verify that all required secrets are set correctly
- Check that certificates haven't expired
- Ensure the certificate matches the bundle identifier

### Out of storage on GitHub Actions

- Artifacts are kept for 90 days by default
- You can manually delete old artifacts from the Actions tab
- Consider cleaning up old workflow runs

## Local Testing

Before pushing, you can test builds locally:

```bash
# Install dependencies
pnpm install

# Build for your current platform
pnpm tauri build

# Build for a specific target
pnpm tauri build --target aarch64-apple-darwin
```

## Resources

- [Tauri Action Documentation](https://github.com/tauri-apps/tauri-action)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Tauri Building Guide](https://tauri.app/v1/guides/building/)
