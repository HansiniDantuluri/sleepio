# SleepIO APK Build Guide

## Prerequisites
- Android Studio installed (Hedgehog or later)
- Java JDK 17+
- Node.js 20+ and `bun` installed
- Android SDK platform 34+ and build-tools installed via Android Studio

## One-time setup (run locally, not inside Lovable)
The Lovable sandbox cannot run the Android SDK, so add the native platform on
your own machine after cloning:

```bash
bun install
bun run build
npx cap add android   # creates the android/ folder
npx cap sync android
```

## Steps to produce a signed APK

1. **Build the web app**
   ```bash
   bun run build
   ```

2. **Sync web assets into the Android project**
   ```bash
   npx cap sync android
   ```

3. **Open Android Studio**
   ```bash
   npx cap open android
   ```

4. **Create a release keystore** (one time)
   ```bash
   keytool -genkey -v -keystore sleepio.keystore \
     -alias sleepio -keyalg RSA -keysize 2048 -validity 10000
   ```
   Keep the keystore and its password safe — losing it means you cannot
   ship updates to existing users.

5. **Configure signing in `android/app/build.gradle`**
   ```gradle
   android {
     signingConfigs {
       release {
         storeFile file('../sleepio.keystore')
         storePassword 'YOUR_PASSWORD'
         keyAlias 'sleepio'
         keyPassword 'YOUR_PASSWORD'
       }
     }
     buildTypes {
       release {
         signingConfig signingConfigs.release
         minifyEnabled false
       }
     }
   }
   ```

6. **Add required permissions** to `android/app/src/main/AndroidManifest.xml`
   (inside the top-level `<manifest>` tag, before `<application>`):
   ```xml
   <uses-permission android:name="android.permission.INTERNET"/>
   <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS"
     tools:ignore="ProtectedPermissions"/>
   ```
   Add `xmlns:tools="http://schemas.android.com/tools"` to the `<manifest>`
   tag if it is not already present.

7. **Generate the signed APK**
   In Android Studio: `Build → Generate Signed Bundle / APK → APK → release`.

8. **Locate the APK**
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

9. **Install on a connected device**
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

## Testing checklist
- ElevenLabs TTS audio (bedtime story) plays inside the Android WebView.
- Supabase-hosted MP3 tracks play and seek correctly in the music player.
- Sleep tracking fires when the app is backgrounded then re-foregrounded
  (both `visibilitychange` and Capacitor `appStateChange` paths).
- The PACKAGE_USAGE_STATS permission prompt appears the first time the user
  enables app blocking in Settings.
- On iOS, app blocking shows the message "App blocking available on
  Android only" and does not crash.

## Notes on app blocking
The optional `@capacitor-community/app-usage` plugin powers foreground-app
detection on Android. It is intentionally not bundled in the web build (the
Lovable npm mirror does not host it). To enable native polling locally:

```bash
bun add @capacitor-community/app-usage
npx cap sync android
```

Once installed, `src/lib/appBlocking.ts` will dynamically load it on Android
and start the 30-second foreground-app poll during Focus Mode sessions.
On iOS or the web build it remains a no-op.