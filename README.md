# Maintenance Tracker

Mobile-first PWA for importing and viewing industrial preventive-maintenance schedules.

## What the supplied workbook contains

`sample-data/November-2026.xlsx` has one worksheet (`Nov`) with 43 machines. The header row contains `SN`, `Machine Code`, `Machine`, `Status`, followed by day columns 1-30. Each machine uses a `Plan` row followed by an `Actual` row. Cells may contain multiple newline-separated codes (for example `MM` and `ME`). The fixture does not provide serial numbers or machine codes, so the parser uses machine name plus the available identifiers as its stable key.

## Run locally

1. Install Node.js 20+.
2. Run `npm install`, `npm --prefix backend install`, and `npm --prefix frontend install`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Run `cd backend; npx prisma migrate dev --name init`.
5. From the repository root, run `npm run dev`.
6. Open `http://localhost:5173`.

The API listens on port 5000. Set `VITE_API_URL` in `frontend/.env` to point at another API URL. SQLite is the default Prisma provider; moving to PostgreSQL requires changing the Prisma provider and `DATABASE_URL`, while application persistence remains behind Prisma.

Machine maintenance rows can be edited from a machine's details page. Saving a row records the done date, person/team, start time, and end time; entering completion details changes its status to `ACTUAL`. The API endpoint is `PATCH /api/maintenance/:id`.

## Validation

`npm --prefix backend test` tests extraction against the supplied workbook, including the month/year and 43-machine count. `npm run build` type-checks and builds both applications.
