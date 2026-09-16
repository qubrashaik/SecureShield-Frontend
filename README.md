# SecureShield Frontend (React + Vite)

Matches your mockup: dark dashboard, EMAIL/SMS/URL tabs, live stats, and an
XAI panel that shows the SHAP feature contributions returned by the Flask
service (via Spring Boot).

## Setup

```bash
npm install
npm run dev
```

Opens at `http://localhost:3000`.

**Requires both backend layers running first:**
1. Flask ML service on `http://localhost:5000`
2. Spring Boot API on `http://localhost:8080`

If your Spring Boot app runs on a different host/port, edit `BASE_URL` in
`src/api.js`.

## Pages

- `/login`, `/register` — JWT auth against Spring Boot's `/api/auth/*`
- `/` — the dashboard (redirects to `/login` if not authenticated)

## How the stats row works

The backend doesn't have a dedicated stats endpoint, so `Dashboard.jsx`
derives "Scans today / Phishing flagged / Spam flagged / Legitimate" from
your scan history client-side. Note your email/sms models return the label
`"Spam/Phishing"` (not split), while the URL model returns `"Phishing"` —
so the dashboard buckets URL-model phishing hits under "Phishing flagged"
and email/sms hits under "Spam flagged". Adjust `labelClass()` in
`Dashboard.jsx` if you'd rather split it differently, or if you update your
training labels later.

## Notes

- Token is stored in `localStorage` under `ss_token` — fine for a college
  project demo, not something you'd ship to production as-is.
- CORS: Spring Boot's `SecurityConfig` currently only allows
  `http://localhost:3000`. Keep the dev server on that port, or update both
  sides together.
