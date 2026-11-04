# Kiosk devices (tablet / POS terminal)

The customer self-service till can run as its own **installed app** on a tablet or point-of-sale computer. It is still part of the same system: it uses the same API and PostgreSQL database as the Cashier station, Kitchen display and Admin console.

## How it works
1. **Register** – Admin → *Kiosk devices* → name the kiosk, choose its location → a one-time **pairing code** (and QR) appears. Codes work once and expire after 24 hours; only a hash is stored.
2. **Pair** – on the tablet open `https://<your-server>/kiosk`, type the code (or scan the QR). The device receives a private device token and is permanently tied to that store location.
3. **Install** – browser menu → *Install app* / *Add to Home screen*. It installs as **SSTWAS Kiosk** (its own icon, full-screen). Opening it goes straight to the welcome screen of that location – no store list, no staff links, no exit button.
4. **Stay connected** – every 20 s the kiosk reports *idle / shopping / paying* to the server.
   - **Admin** sees each kiosk as Online · ready / Customer shopping / Customer paying / Offline, with last-seen time.
   - **Cashier station** shows the same status on its overview, and a cash order created at a kiosk is labelled **Kiosk · <name>** so the cashier knows where to go.
   - Paid food orders still flow to the Kitchen display; stock is shared with every other channel.
5. **Control** – Admin can put a kiosk in **Maintenance mode** (tablet shows "temporarily out of service"), **Unpair** it (tablet returns to the setup screen and a new code is issued) or remove it. All of this is in the Activity log.

Kiosk behaviour: keeps the screen awake, blocks text selection/overscroll, returns to the welcome screen after 3 minutes of inactivity (clearing the cart), and returns from the receipt page automatically after 90 s or when the customer taps *Finish — next customer*.

## Installing on a tablet during development
Browsers only allow **installing** a web app (and keeping the screen awake) from a secure address – HTTPS or `localhost`. Pairing and using the kiosk in the browser works over plain HTTP on your Wi-Fi.

For install testing on a tablet, using the PC's address (example `192.168.1.113`):
1. On the PC: `npm run build` then `npm run preview -- --host --port 5174` (the install prompt needs the production build). Keep `npm run api:dev` running.
2. On the tablet open `http://192.168.1.113:5174/kiosk` and pair.
3. To enable *Install app* on that plain-HTTP address in Chrome/Android: open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://192.168.1.113:5174`, enable, relaunch Chrome. (Test devices only.)
4. For the real deployment, host the app on HTTPS (any hosting or a tunnel such as Cloudflare Tunnel) and set `APP_ORIGIN` in `server/.env` to that address.

In development the API automatically accepts requests from devices on your private network (192.168.x.x, 10.x.x.x, 172.16–31.x.x). In production only the origins in `APP_ORIGIN` are accepted.

## Lock the device down (optional)
Android: *Screen pinning* or a kiosk launcher. iPad: *Guided Access*. Windows POS: *Assigned access* (kiosk mode) with Edge/Chrome opening the installed app. For unattended receipt printing, start Chrome with `--kiosk-printing` and set the thermal printer as default; otherwise the browser print dialog appears.
