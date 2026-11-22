# CineSphere frontend

This folder runs the classic CineSphere movie site, including its EJS pages, styles, movie search, and movie-management forms.

## Run the frontend

Install the shared movie/database dependencies once, starting from the project root:

```powershell
cd .\back
npm install
cd ..\front
npm install
```

Start MongoDB, then run only the frontend server to open the website:

```powershell
cd .\front
npm start
```

Open **http://localhost:4200**. The frontend reads the MongoDB settings from `back/.env` (or uses the default local `movies` database).

## Run the API for Postman

In a second terminal:

```powershell
cd .\back
npm install
npm start
```

The API runs at **http://localhost:3001**. Its root URL returns a JSON success message; movie endpoints are under `/api` (for example, `GET /api/movies`). The frontend and API are separate servers.

To add the curated movies safely, run `npm run seed` from `back/`. It does not delete or overwrite existing catalog records.
