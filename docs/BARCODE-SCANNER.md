# Barcode scanner hardware (kiosk and back office)

SSTWAS works with ordinary retail barcode scanners (laser, CCD or 2D imager; wired or Bluetooth). Use a scanner that reads **EAN-13, EAN-8, UPC-A and Code 128**.

## Connecting a scanner to a kiosk
1. Plug the scanner into the kiosk (USB) or pair it by Bluetooth. In its default **USB keyboard (HID) mode** it needs no driver.
2. Open the kiosk, tap the **Scanner** chip in the header (or on the welcome screen) and scan any product. The code appears in the **Test** box. That confirms the scanner works.
3. Customers just scan. The first scan on the welcome screen starts their shopping; every scan adds one unit. The beep is high for "added" and low for "problem" (unknown code or out of stock). Hold the scanner on the same item twice to add two.

### Scanner modes
| Mode | Use when | Notes |
|---|---|---|
| USB / Bluetooth keyboard (default) | almost every scanner | The scanner must send **Enter** (CR) after the code, the factory default. Keys faster than 60 ms apart are treated as a scan, so staff typing is ignored. |
| USB serial / RS-232 | scanner set to "USB-COM / virtual serial" | Chrome or Edge on https or localhost. Press **Connect scanner** once, choose the port. It reconnects by itself after a reload and warns if unplugged. |

If scans are missed on a slow Bluetooth scanner, open **Advanced** and raise "Max gap between keys". Settings are saved per kiosk.

## Back office (General Admin)
- **Add product (grocery):** click the Barcode box and scan the product. The form checks the check digit (EAN/UPC), shows "valid / wrong check digit", and refuses a barcode already used by another product (also enforced on the server).
- **Products > Scan to find or add:** scanning an existing barcode opens that product for editing; an unknown barcode starts a new product with the barcode filled in.
- **Inventory > Scan product to select:** receive stock by scanning each product, typing the quantity and saving.
- **Products without a manufacturer barcode:** use *Generate in-store barcode*, then **Print all QR labels**. Labels include a printed EAN-13 barcode that the kiosk scanner can read, plus a QR for phones.

## Troubleshooting
- Nothing happens on scan: tap the Scanner chip and scan; if the Test box stays empty the scanner is not in keyboard mode (scan the "USB HID keyboard" setup barcode from its manual) or not paired.
- Digits appear but no product is added: the barcode is not in this store's catalogue. Add it in Admin, Products.
- Wrong characters: set the scanner's keyboard layout to match the kiosk, or use serial mode.
