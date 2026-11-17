# Android Bluetooth printer companion

The installable Android app adds direct printing for paired Bluetooth Classic printers that support ESC/POS over the SPP serial profile. The web app continues to use the browser print dialog on other devices.

## Compatibility

- Android 6.0 or later; Bluetooth enabled.
- Pair the printer from Android **Settings → Bluetooth** before opening the till.
- The printer must accept Bluetooth Classic/SPP connections and ESC/POS text and QR commands.
- BLE/GATT-only devices, proprietary printer protocols, and unsupported ESC/POS variants are not covered by this adapter.
- The SF325 has not yet been verified against the adapter. Test it with a sample receipt before relying on it in production.

The adapter selects one paired printer per Android device. It prints receipts and kitchen tickets without opening the system print dialog. Other browsers and devices retain their existing browser-print flow.

## Build the Android app

Install Android Studio with the Android SDK and Java 17 or later. Set the deployed Tillcore web-app URL in PowerShell, then sync the Android project:

```powershell
$env:CAPACITOR_SERVER_URL = "https://your-till-domain.example"
npm run android:sync
npm run android:open
```

In Android Studio, allow Gradle sync to finish and build an APK using **Build → Build Bundle(s) / APK(s) → Build APK(s)**. Install that APK on each Android till device. Keep `CAPACITOR_SERVER_URL` on HTTPS; only localhost is allowed over HTTP for development.

The companion loads the configured Tillcore site, so the app URL must be reachable from the device. Rebuild and redistribute the APK if the configured site URL changes.

## Select and test a printer

1. Pair the printer in Android Bluetooth settings.
2. Open Tillcore in the installed app and sign in.
3. Open **Bluetooth printer setup** on the receipt or Kitchen screen.
4. Allow Android's **Nearby devices** permission, refresh the list, and select the printer.
5. Tap **Print test** before taking orders.

Printing errors are shown in the Tillcore screen. If the test fails, confirm that the printer is paired, powered on, and supports ESC/POS over SPP. Compatibility with a particular model still requires testing on that printer.
