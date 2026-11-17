package com.tillcore.sstwas;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.text.Normalizer;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(alias = "bluetoothConnect", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class BluetoothPrinterPlugin extends Plugin {
    private static final String PREFERENCES = "tillcore_printer";
    private static final String PRINTER_ADDRESS = "address";
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private final ExecutorService printQueue = Executors.newSingleThreadExecutor();
    private final ConcurrentHashMap<String, Runnable> permissionActions = new ConcurrentHashMap<>();

    @PluginMethod
    public void getPairedPrinters(PluginCall call) {
        withBluetoothPermission(call, () -> {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("This Android device does not support Bluetooth.");
                return;
            }
            try {
                JSArray printers = new JSArray();
                Set<BluetoothDevice> devices = adapter.getBondedDevices();
                for (BluetoothDevice device : devices) {
                    JSObject printer = new JSObject();
                    printer.put("name", device.getName() == null ? "Bluetooth printer" : device.getName());
                    printer.put("address", device.getAddress());
                    printers.put(printer);
                }
                JSObject result = new JSObject();
                result.put("printers", printers);
                String selected = getContext().getSharedPreferences(PREFERENCES, 0)
                    .getString(PRINTER_ADDRESS, null);
                result.put("selectedAddress", selected);
                call.resolve(result);
            } catch (SecurityException error) {
                call.reject("Bluetooth permission is required to list paired devices.", error);
            }
        });
    }

    @PluginMethod
    public void selectPrinter(PluginCall call) {
        String address = call.getString("address");
        if (address == null || !address.matches("(?i)[0-9a-f]{2}(:[0-9a-f]{2}){5}")) {
            call.reject("Choose a valid paired Bluetooth printer.");
            return;
        }
        withBluetoothPermission(call, () -> {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null) {
                call.reject("This Android device does not support Bluetooth.");
                return;
            }
            try {
                BluetoothDevice selected = null;
                for (BluetoothDevice device : adapter.getBondedDevices()) {
                    if (address.equalsIgnoreCase(device.getAddress())) {
                        selected = device;
                        break;
                    }
                }
                if (selected == null) {
                    call.reject("That printer is not paired with this Android device. Pair it in Bluetooth settings first.");
                    return;
                }
                getContext().getSharedPreferences(PREFERENCES, 0).edit()
                    .putString(PRINTER_ADDRESS, selected.getAddress())
                    .apply();
                JSObject result = new JSObject();
                result.put("name", selected.getName() == null ? "Bluetooth printer" : selected.getName());
                result.put("address", selected.getAddress());
                call.resolve(result);
            } catch (SecurityException error) {
                call.reject("Bluetooth permission is required to select a printer.", error);
            }
        });
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        try {
            getActivity().startActivity(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS));
            call.resolve();
        } catch (Exception error) {
            call.reject("Could not open Android Bluetooth settings.", error);
        }
    }

    @PluginMethod
    public void print(PluginCall call) {
        String text = call.getString("text");
        String qrData = call.getString("qrData", "");
        if (text == null || text.trim().isEmpty()) {
            call.reject("There is no receipt text to print.");
            return;
        }
        if (text.length() > 12000 || qrData.length() > 512) {
            call.reject("The print job is too large.");
            return;
        }
        withBluetoothPermission(call, () -> printQueue.execute(() -> printJob(call, text, qrData)));
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        Runnable action = permissionActions.remove(call.getCallbackId());
        if (action == null) {
            call.reject("The Bluetooth permission request expired. Please try again.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            && !hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            call.reject("Bluetooth permission was denied. Allow Nearby devices access to print.");
            return;
        }
        action.run();
    }

    private void withBluetoothPermission(PluginCall call, Runnable action) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S
            || hasPermission(Manifest.permission.BLUETOOTH_CONNECT)) {
            action.run();
            return;
        }
        permissionActions.put(call.getCallbackId(), action);
        requestPermissionForAlias("bluetoothConnect", call, "bluetoothPermissionCallback");
    }

    private void printJob(PluginCall call, String text, String qrData) {
        BluetoothSocket socket = null;
        try {
            BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Turn on Bluetooth before printing.");
                return;
            }
            String address = getContext().getSharedPreferences(PREFERENCES, 0)
                .getString(PRINTER_ADDRESS, null);
            if (address == null) {
                call.reject("Select a paired Bluetooth printer in Printer settings first.");
                return;
            }
            BluetoothDevice device = adapter.getRemoteDevice(address);
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            OutputStream output = socket.getOutputStream();
            output.write(new byte[] { 0x1B, 0x40 });
            output.write(ascii(text));
            output.write(new byte[] { 0x0A, 0x0A });
            if (!qrData.isEmpty()) {
                output.write(new byte[] { 0x1B, 0x61, 0x01 });
                writeQr(output, qrData);
                output.write(new byte[] { 0x0A, 0x0A });
            }
            output.write(new byte[] { 0x1B, 0x61, 0x00, 0x0A, 0x0A, 0x0A });
            output.flush();
            JSObject result = new JSObject();
            result.put("printed", true);
            call.resolve(result);
        } catch (SecurityException error) {
            call.reject("Bluetooth permission was denied. Allow Nearby devices access to print.", error);
        } catch (Exception error) {
            call.reject("Could not print. Check that the printer is on, paired, and supports Bluetooth SPP with ESC/POS.", error);
        } finally {
            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {
                }
            }
        }
    }

    private byte[] ascii(String text) {
        String normalized = Normalizer.normalize(text, Normalizer.Form.NFD)
            .replaceAll("\\p{M}", "");
        String safe = normalized.replaceAll("[^\\x09\\x0A\\x0D\\x20-\\x7E]", "?");
        return safe.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
    }

    private void writeQr(OutputStream output, String qrData) throws Exception {
        byte[] data = ascii(qrData);
        int length = data.length + 3;
        output.write(new byte[] { 0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00 });
        output.write(new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x05 });
        output.write(new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30 });
        output.write(new byte[] {
            0x1D, 0x28, 0x6B, (byte) (length & 0xFF), (byte) ((length >> 8) & 0xFF), 0x31, 0x50, 0x30
        });
        output.write(data);
        output.write(new byte[] { 0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30 });
    }
}
