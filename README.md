# CUOS

CUOS is a full-stack project with:

- `client/` for the React + Vite frontend
- `server/` for the Node.js + Express + TypeScript backend

This guide helps someone take the latest code, install dependencies, set up environment variables, and run the project locally.

## 1. Pull the latest code

If the project is already cloned:

```bash
git checkout main
git pull origin main
```

If you work on another branch:

```bash
git checkout your-branch-name
git pull origin your-branch-name
```

If you are cloning for the first time:

```bash
git clone <your-repo-url>
cd CUOS
```

## 2. Install dependencies

Install frontend dependencies:

```bash
cd client
npm install
```

Install backend dependencies:

```bash
cd ../server
npm install
```

Return to project root if needed:

```bash
cd ..
```

## 3. Create environment files

This project needs environment variables for both backend and frontend.

### Backend `.env`

Create a file at `server/.env` and add:

```env
NODE_ENV=development
PORT=8000
MONGO_URI=mongodb://localhost:27017/cuos

JWT_ACCESS_SECRET=your_jwt_access_secret_at_least_32_characters
JWT_REFRESH_SECRET=your_jwt_refresh_secret_at_least_32_characters

FRONTEND_URL=http://localhost:5173

RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@creativeupaay.com

CALCOM_BOOKING_URL=
CALCOM_FALLBACK_BOOKING_URL_TEMPLATE=
CALCOM_API_BASE_URL=https://api.cal.com
CALCOM_API_TOKEN=
CALCOM_API_VERSION=2024-06-14
CALCOM_DEFAULT_ORGANIZER=HR Team
CALCOM_EVENT_LOCATION_INTEGRATION=google-meet
CALCOM_WEBHOOK_SECRET=

SUPER_ADMIN_EMAIL=admin@creativeupaay.com
SUPER_ADMIN_PASSWORD=Admin@123
```

Notes:

- `MONGO_URI` is required.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be at least 32 characters long.
- `RESEND_*` and `CALCOM_*` values can stay empty for local setup unless that feature is needed.

### Frontend `.env`

Create a file at `client/.env` and add:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

## 4. Seed initial roles and admin user

Run this once after MongoDB is available:

```bash
cd server
npm run seed
```

This uses:

- `SUPER_ADMIN_EMAIL` from `server/.env`
- `SUPER_ADMIN_PASSWORD` from `server/.env`

If not provided, the defaults are:

- Email: `admin@creativeupaay.com`
- Password: `Admin@123`

## 5. Run the backend

From the `server` folder:

```bash
npm run dev
```

Backend runs on:

```text
http://localhost:8000
```

API base URL:

```text
http://localhost:8000/api/v1
```

## 6. Run the frontend

Open another terminal and run:

```bash
cd client
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

## 7. Production build check

Frontend build:

```bash
cd client
npm run build
```

Backend build:

```bash
cd server
npm run build
```

## 8. Quick local startup summary

Open 2 terminals.

Terminal 1:

```bash
cd server
npm install
npm run dev
```

Terminal 2:

```bash
cd client
npm install
npm run dev
```

## 9. Common issues

### App fails because env variables are missing

Check `server/.env`. The backend validates env variables on startup and will stop if required values are missing.

### Frontend cannot connect to backend

Check:

- backend is running on `http://localhost:8000`
- `client/.env` contains `VITE_API_BASE_URL=http://localhost:8000/api/v1`

After changing frontend env variables, restart the frontend dev server.

### MongoDB connection error

Make sure MongoDB is running locally or update `MONGO_URI` to your remote database connection string.

## 10. Useful commands

Frontend:

```bash
cd client
npm run dev
npm run build
npm run lint
```

Backend:

```bash
cd server
npm run dev
npm run build
npm run type-check
npm run lint
npm run seed
```
