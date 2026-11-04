# SSTWAS 2.0 — Windows setup from a clean download

These steps start the complete React + Express + PostgreSQL application **without any cloud configuration**. Keep your existing other project folders untouched.

## 1. Extract and open the correct folder

Extract `SSTWAS-2.0-Clean-PostgreSQL.zip`. The ZIP entries start with `package.json`, `src/`, `server/`, and `docs/`; there should be no second application folder inside. In VS Code choose **File → Open Folder** and open the extracted folder. In a PowerShell terminal run:

```powershell
Test-Path .\package.json
```

It should print `True`. Don't include the `PS C:\...>` prompt when pasting commands.

## 2. Prepare PostgreSQL

Open pgAdmin 4, connect to the local PostgreSQL server, then right-click **Databases → Create → Database** and create `sstwas_dev`.

In the project terminal, run:

```powershell
Copy-Item .\server\.env.example .\server\.env
notepad .\server\.env
```

In the file, set `DATABASE_URL` with your actual PostgreSQL account/password and port (often 5432):

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/sstwas_dev
PORT=3001
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-unique-random-value-of-at-least-32-characters
```

If the database password has characters such as `@`, `#`, `:` or `/`, percent-encode those characters in the URL. Never share your actual password with anyone or put `server/.env` into GitHub.

## 3. Install project dependencies

```powershell
npm install
npm --prefix server install
```

## 4. Create tables

```powershell
npm run db:migrate
```

## 5. Create the first Super Admin once

Temporarily add these entries to `server/.env` (choose your own email and strong password):

```dotenv
BOOTSTRAP_ADMIN_EMAIL=your-email@example.com
BOOTSTRAP_ADMIN_PASSWORD=ChooseYourOwnStrongPassword123
```

Run:

```powershell
npm run bootstrap:admin
```

After it succeeds, remove **both** `BOOTSTRAP_*` entries from `server/.env`. This creates a new local staff account. Any previous web login credentials are not reused automatically.

## 6. Add optional example shops and verify the source

```powershell
npm run db:seed
npm test
npm run build
```

`db:seed` adds 3 demonstration stores (grocery, food and fashion) with products and stock and skips them on later seed runs. If you want to register stores from Admin yourself, skip the seed command.

## 7. Start the backend and frontend

Keep PostgreSQL running. Open **two** PowerShell terminals in the project folder.

Terminal A:

```powershell
npm run api:dev
```

Verify in Chrome: `http://localhost:3001/api/health` should report `ok: true` and `database: postgresql`.

Terminal B:

```powershell
npm run dev
```

Open the address Vite shows in the terminal (usually `http://localhost:5173` or `http://localhost:5174`). Staff login is `/login`; Admin is `/admin`; Cashier is `/cashier`; Kitchen is `/kitchen`; the customer store directory is `/`.

If your browser shows the old application, close old Vite servers, use the new localhost URL, hard refresh (`Ctrl + Shift + R`) and clear old site data/service-worker cache if needed.

## 8. First end-to-end checkout test

Sign in as Super Admin → register a grocery store (unless you seeded) → add product and stock → open store mobile/kiosk → add two items → simulate card/EcoCash approval → verify the database stock decreased by two → view a receipt. Test a declined payment (stock unchanged), then a cash order (pending until Cashier confirms). Finally, verify grocery exit QR once and confirm a second attempt is flagged. Test food preparation, clothing collection and the actual receipt printer separately.

If any command fails, copy only the terminal error (not passwords or `.env` contents) and check `docs/ACCEPTANCE-CHECKLIST.md`.
