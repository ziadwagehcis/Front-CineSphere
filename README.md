# CineSphere Frontend

The Express/EJS website renders the movie catalog and sends all movie operations to the separately deployed CineSphere API. It does not connect directly to MongoDB or need database credentials.

## Run locally

```powershell
npm install
npm start
```

Open **http://localhost:4200**. Set `BACKEND_API_URL` only if the API is hosted somewhere other than the production default.

## Vercel

Deploy this repository with its root directory set to the repository root. Vercel detects the Express app in `server.js` and serves static assets from `public/`.

The production frontend calls **https://back-cinesphere.vercel.app** by default. To override this, set `BACKEND_API_URL` to the backend origin (with or without the trailing `/api`). No MongoDB credentials should be added to this frontend project.

Movie poster images should use public image URLs. Vercel function filesystems are temporary, so uploaded local files are not suitable for persistent posters.
