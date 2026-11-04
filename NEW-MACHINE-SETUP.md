# Installing SSTWAS 2.0 on a new machine (Windows)

1. Install **Node.js 20+** (nodejs.org) and **PostgreSQL 16+** (remember the postgres password and the port it uses: 5432 by default).
2. Unzip, open PowerShell **inside** the SSTWAS-2.0 folder (it must contain package.json).
3. Create the database (adjust the port if yours is not 5432):
   `psql -U postgres -p 5432 -c "CREATE DATABASE sstwas_dev;"`
   If `psql` is not recognised, use the full path, e.g. `& "C:\Program Files\PostgreSQL\17\bin\psql.exe" ...`
4. Configure the API: `copy server\.env.example server\.env`, then edit `server\.env`:
   - `DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/sstwas_dev`
   - set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD` (12+ chars, upper+lower+digit) and `BOOTSTRAP_ADMIN_NAME`.
5. Install and prepare:
   ```
   npm install
   npm --prefix server install
   npm run db:migrate
   npm run bootstrap:admin
   ```
   Optional demo data: set `DEMO_STAFF_PASSWORD` in server\.env, then `npm run db:seed`.
6. Run (two terminals, both in the project folder):
   - API: `npm run api:dev`
   - Web: `npm run dev -- --port 5174 --strictPort`
7. Open http://localhost:5174 and sign in at /admin with the Super Admin you bootstrapped.

Phones and tablets on the same Wi-Fi: use `http://<this PC's IP>:5174`. Allow Node through Windows Firewall when asked. Camera scanning and tablet install need HTTPS when not on localhost.

Your old data does not move automatically. To copy it: `pg_dump -U postgres sstwas_dev > backup.sql` on the old PC, then `psql -U postgres -d sstwas_dev -f backup.sql` on the new one (skip steps db:migrate/bootstrap in that case).
