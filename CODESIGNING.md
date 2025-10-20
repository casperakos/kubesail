# Code Signing for KubeSail

## macOS Installation (Unsigned Builds)

If you download an unsigned `.dmg` or `.app` and see the error:

> "kubesail" is damaged and can't be opened. You should move it to the Trash.

This is macOS Gatekeeper blocking unsigned applications. Here are three ways to install:

### Option 1: Right-Click to Open (Easiest)
1. Right-click (or Control-click) on `kubesail.app`
2. Select **Open** from the context menu
3. Click **Open** in the dialog that appears
4. The app will now run and be allowed in the future

### Option 2: Remove Quarantine Flag (Terminal)
```bash
# For .app bundles
xattr -cr /path/to/kubesail.app

# For .dmg files
xattr -cr /path/to/kubesail.dmg
```

### Option 3: System Settings
1. Try to open the app (it will be blocked)
2. Go to **System Settings** → **Privacy & Security**
3. Scroll down to the **Security** section
4. Click **Open Anyway** next to the KubeSail message
5. Click **Open** in the confirmation dialog

## Production Code Signing Setup

To distribute signed macOS builds, you need an **Apple Developer account** ($99/year).

### Prerequisites
1. Apple Developer account (https://developer.apple.com)
2. Developer ID Application certificate
3. App-specific password for notarization

### Step 1: Get Your Certificates

1. **Create a Certificate Signing Request (CSR)**:
   - Open **Keychain Access** on macOS
   - Menu: **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority**
   - Enter your email and name
   - Select "Saved to disk"
   - Save the CSR file

2. **Create Developer ID Certificate**:
   - Go to https://developer.apple.com/account/resources/certificates/list
   - Click the **+** button to create a new certificate
   - Select **Developer ID Application**
   - Upload your CSR file
   - Download the certificate (.cer file)
   - Double-click to install it in Keychain Access

3. **Export Certificate**:
   - Open **Keychain Access**
   - Find your "Developer ID Application" certificate
   - Right-click → **Export**
   - Choose **Personal Information Exchange (.p12)**
   - Set a password (you'll need this for GitHub secrets)
   - Save the file

4. **Convert to Base64**:
   ```bash
   base64 -i /path/to/certificate.p12 | pbcopy
   # This copies the base64 string to your clipboard
   ```

### Step 2: Get App-Specific Password

1. Go to https://appleid.apple.com
2. Sign in with your Apple ID
3. Under **Security** → **App-Specific Passwords**
4. Click **Generate Password**
5. Label it "GitHub Actions KubeSail"
6. Save this password securely

### Step 3: Configure GitHub Secrets

Go to your repository settings → **Secrets and variables** → **Actions**, and add these secrets:

| Secret Name | Description | Value |
|-------------|-------------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 certificate | The base64 string from Step 1 |
| `APPLE_CERTIFICATE_PASSWORD` | Password for .p12 file | Password you set when exporting |
| `APPLE_SIGNING_IDENTITY` | Certificate identity | Usually starts with "Developer ID Application:" |
| `APPLE_ID` | Your Apple ID email | yourname@example.com |
| `APPLE_PASSWORD` | App-specific password | From Step 2 |
| `APPLE_TEAM_ID` | Your Apple Team ID | Found at https://developer.apple.com/account |

### Step 4: Get Your Signing Identity

To find your signing identity:
```bash
security find-identity -v -p codesigning
```

Look for the line with "Developer ID Application". Copy the full name, for example:
```
Developer ID Application: Your Name (TEAM123456)
```

### Step 5: Rebuild

Once all secrets are configured, create a new release or push to trigger the workflow. The build will now:
1. ✅ Sign the application with your Developer ID
2. ✅ Notarize the app with Apple
3. ✅ Staple the notarization ticket
4. ✅ Create a distributable .dmg that users can install without warnings

## Verification

After signing, users can verify the signature:
```bash
# Check code signature
codesign --verify --verbose /path/to/kubesail.app

# Display signature information
codesign -dv /path/to/kubesail.app

# Check notarization
spctl -a -vv /path/to/kubesail.app
```

## Troubleshooting

### "No identity found" during build
- Make sure `APPLE_SIGNING_IDENTITY` matches exactly what's in your keychain
- Verify the certificate is installed: `security find-identity -v -p codesigning`

### Notarization fails
- Check that `APPLE_ID` and `APPLE_PASSWORD` are correct
- Ensure you're using an app-specific password, not your main Apple ID password
- Verify `APPLE_TEAM_ID` is correct (10-character string)

### Certificate expired
- Certificates expire after a few years
- Create a new certificate using the same process
- Update the `APPLE_CERTIFICATE` secret with the new base64-encoded .p12

## References

- [Tauri Code Signing Guide](https://tauri.app/v1/guides/distribution/sign-macos)
- [Apple Developer Documentation](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [tauri-action Documentation](https://github.com/tauri-apps/tauri-action)
