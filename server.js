const express = require("express");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const { getDb, closeConnection } = require("../back/models/mongodbConnection");

const app = express();
const movieModel = require("../back/models/movieModel");
app.disable("x-powered-by");
app.use(compression());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
    });
    next();
});

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public"), {
    maxAge: "7d",
    immutable: true,
    etag: true,
    lastModified: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.locals.siteName = "CineSphere";
app.locals.getMoviePoster = function (thumbnail, poster) {
    const candidates = [thumbnail, poster];
    const clean = candidates
        .find(value => typeof value === "string" && value.trim() &&
            value.trim() !== "/img/placeholder-poster.svg");
    if (!clean) {
        return "/img/placeholder-poster.svg";
    }
    const value = clean.trim();
    if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
        return value;
    }
    return `/img/movies/${value}`;
};

app.use(require("../back/route/web"));

app.use((req, res) => {
    res.status(404).render("pages/movies/show", {
        movie: null,
        relatedMovies: [],
        pageTitle: "404 - Page Not Found",
        alert: null
    });
});

app.use((err, req, res, next) => {
    console.error("Unhandled frontend error:", err);
    if (res.headersSent) return next(err);
    res.status(500).render("pages/movies/show", {
        movie: null,
        relatedMovies: [],
        pageTitle: "500 - Server Error",
        alert: null
    });
});

const port = process.env.FRONT_PORT || 4200;
getDb()
    .then(async () => {
        await movieModel.ensureIndexes();
        console.log("[CineSphere Frontend] MongoDB database connected and catalog indexes verified.");
    })
    .catch(err => console.warn(`[CineSphere Frontend] Initial MongoDB connection warning: ${err.message}.`));

const server = app.listen(port, () => {
    console.log(`[CineSphere Frontend] Classic movie site running at http://localhost:${port}`);
});

async function shutdown(signal) {
    console.log(`\n${signal}: shutting down frontend...`);
    server.close(async () => {
        await closeConnection();
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
