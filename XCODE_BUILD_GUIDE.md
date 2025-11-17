# Bus Buddy iOS App - Xcode Build & TestFlight Guide

This guide will walk you through building your Bus Buddy iOS app in Xcode and uploading it to TestFlight to replace your existing app.

---

## Part 1: Open the Project in Xcode

1. **Open Finder** and navigate to your Bus Buddy project folder
2. Find the `ios` folder and open it
3. **Double-click** on `App.xcworkspace` (NOT `App.xcodeproj`)
   - ⚠️ **Important:** Always use `.xcworkspace`, not `.xcodeproj`
4. Xcode will launch and load your project

---

## Part 2: Configure Your Developer Account

### First Time Setup Only:

1. In Xcode, go to **Xcode → Settings** (or Preferences on older versions)
2. Click the **Accounts** tab
3. Click the **+** button at the bottom left
4. Choose **Apple ID** and sign in with your Apple Developer account
5. After signing in, click **Download Manual Profiles** (optional but recommended)

---

## Part 3: Configure App Signing & Bundle ID

### Update Bundle Identifier:

1. In the left sidebar, click on **App** (the blue icon at the top)
2. In the main panel, make sure **App** target is selected (under TARGETS)
3. Click the **Signing & Capabilities** tab
4. You'll see:
   - **Bundle Identifier:** Currently set to `com.bytevia.busbuddy`
   - **Team:** Select your Apple Developer team from the dropdown

### Enable Automatic Signing:

1. Check the box **Automatically manage signing**
2. Select your **Team** from the dropdown
3. Xcode will automatically create provisioning profiles

### Troubleshooting Signing Errors:

If you see a red error about bundle identifier conflicts:
- **Option A:** Change the bundle ID to something unique like `com.yourname.busbuddy`
- **Option B:** In your Apple Developer account, delete the old app with the same bundle ID

---

## Part 4: Build for a Real Device (Testing)

### Connect Your iPhone:

1. **Connect your iPhone** to your Mac using a USB cable
2. **Unlock your iPhone** and tap **Trust** if prompted
3. At the top of Xcode, next to the play button, click the device selector
4. Choose **your iPhone** from the list (it will show your iPhone's name)

### Build and Run:

1. Click the **Play button** (▶️) at the top left, or press `Cmd+R`
2. Xcode will compile and install the app on your iPhone
3. **First time only:** On your iPhone, go to **Settings → General → VPN & Device Management**
   - Tap your developer profile
   - Tap **Trust**
4. The app should launch on your iPhone

### Test Push Notifications:

- The app will request permission for notifications on first launch
- Accept the permission
- The app will register with Apple Push Notification service (APNS)
- Push tokens will be stored in your database

---

## Part 5: Archive for TestFlight

This creates a version you can upload to TestFlight for beta testing.

### Create an Archive:

1. In the device selector at the top, choose **Any iOS Device (arm64)**
   - ⚠️ **Important:** Must select "Any iOS Device", NOT your connected iPhone
2. Go to **Product → Archive** (or press `Cmd+Shift+B`)
3. Xcode will compile and create an archive (this takes 2-5 minutes)
4. When finished, the **Organizer** window will open automatically

### Validate the Archive (Optional):

1. In the Organizer, select your archive
2. Click **Validate App** button on the right
3. Choose your **Team** and click **Next**
4. Accept the default settings and click **Validate**
5. Wait for validation to complete (checks for errors)

---

## Part 6: Upload to TestFlight

### Upload Your Build:

1. In the Organizer window, make sure your archive is selected
2. Click **Distribute App** button on the right
3. Choose **TestFlight & App Store** and click **Next**
4. Choose **Upload** and click **Next**
5. Select **Automatically manage signing** and click **Next**
6. Review the information and click **Upload**
7. Wait for upload to complete (2-10 minutes depending on internet speed)

### Configure in App Store Connect:

1. Open a web browser and go to [App Store Connect](https://appstoreconnect.apple.com)
2. Sign in with your Apple Developer account
3. Click **My Apps**
4. Find your existing **Bus Buddy** app (or create a new one if needed)
5. Click on the app to open it
6. Go to the **TestFlight** tab at the top
7. Under **iOS Builds**, you'll see your new build processing
   - Status will show "Processing" for 5-15 minutes
   - Apple checks the app for issues
   - You'll receive an email when ready

### Add Testers:

1. Once processing completes, click on the build number
2. In the **Test Information** section, fill out:
   - **What to Test:** "Latest bug fixes and improvements"
   - Any other required fields
3. Go to the **TestFlight** tab → **Testers & Groups**
4. Click **+ Add Tester** or use existing test groups
5. Add email addresses of people who should test
6. Click **Save**
7. Testers will receive an email invite

### Test on Devices:

1. Testers download the **TestFlight** app from the App Store
2. They open the invite email and tap **View in TestFlight**
3. Tap **Install** to download your app
4. Your new build will replace the old one

---

## Part 7: Update the App in the Future

Whenever you make changes and want to upload a new build:

1. **On Replit:**
   ```bash
   npm run build
   npx cap sync
   ```
   - This updates the `ios` folder with your latest web changes

2. **Download the updated project:**
   - Download your Replit project as a ZIP
   - Extract it on your Mac
   - The `ios` folder contains the updated Xcode project

3. **In Xcode:**
   - Open `ios/App.xcworkspace`
   - Increment the **Build Number** (found in General tab, under "Build")
     - Example: 1 → 2, 2 → 3, etc.
     - ⚠️ Each upload must have a unique, incrementing build number
   - Repeat **Part 5** and **Part 6** to archive and upload

---

## Troubleshooting Common Issues

### "No Such Module 'Capacitor'" Error:

This means CocoaPods dependencies aren't installed.

**Fix:**
```bash
cd ios/App
pod install
```

Then reopen `App.xcworkspace` in Xcode.

---

### Signing Errors:

**"Failed to register bundle identifier":**
- The bundle ID is already used by another app
- Change it in Xcode: Signing & Capabilities → Bundle Identifier
- Also update `capacitor.config.ts` with the new bundle ID

**"No signing certificate found":**
- Go to Xcode → Settings → Accounts
- Select your account and click **Download Manual Profiles**
- Or create a new certificate in [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates)

---

### Build Fails with Errors:

1. **Clean the build:** Product → Clean Build Folder (`Cmd+Shift+K`)
2. **Delete derived data:**
   - Xcode → Settings → Locations → Derived Data
   - Click the arrow to open in Finder
   - Delete the entire folder
3. Try building again

---

### Archive Button is Grayed Out:

- Make sure you selected **Any iOS Device (arm64)** in the device selector
- If a physical device or simulator is selected, Archive won't work

---

### TestFlight Build Stuck on "Processing":

- Usually takes 5-15 minutes
- Can sometimes take up to 1 hour
- If stuck for >2 hours, try uploading a new build with incremented build number

---

### Push Notifications Not Working:

**On your iPhone:**
1. Settings → Bus Buddy → Notifications
2. Make sure **Allow Notifications** is ON

**In Xcode:**
1. Go to Signing & Capabilities tab
2. Make sure **Push Notifications** capability is added
   - If not, click **+ Capability** and add it

**In Apple Developer Portal:**
1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)
2. Click **Identifiers** → Your app's bundle ID
3. Make sure **Push Notifications** is checked
4. If not, enable it and regenerate your provisioning profile

---

## Quick Reference Checklist

### Before Every Upload:

- [ ] Run `npm run build && npx cap sync` on Replit
- [ ] Download and extract updated project
- [ ] Open `ios/App.xcworkspace` in Xcode
- [ ] Increment Build Number (if updating existing app)
- [ ] Select "Any iOS Device (arm64)"
- [ ] Product → Archive
- [ ] Distribute App → TestFlight & App Store → Upload
- [ ] Wait for email confirmation from Apple

---

## Getting Help

- **Apple Developer Documentation:** https://developer.apple.com/documentation
- **Capacitor iOS Documentation:** https://capacitorjs.com/docs/ios
- **TestFlight Guide:** https://developer.apple.com/testflight/

---

## Current App Configuration

- **Bundle ID:** `com.bytevia.busbuddy`
- **App Name:** Bus Buddy
- **Platforms:** iOS 13.0+, Android 8.0+
- **Capabilities Needed:**
  - Push Notifications (for APNS)
  - Background Modes (for location updates - if needed in future)

---

**You're all set!** Follow this guide each time you want to upload a new version to TestFlight. The process gets faster with practice - after a few times, you'll be able to do it in under 10 minutes.
