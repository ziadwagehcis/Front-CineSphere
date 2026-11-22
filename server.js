const express = require("express");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");

const app = express();
const { backendBaseUrl } = require("./lib/backendApi");
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
app.locals.backendApiUrl = backendBaseUrl;
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

app.use(require("./routes/web"));

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
const server = app.listen(port, () => {
    console.log(`[CineSphere Frontend] Web app listening on port ${port}; API: ${backendBaseUrl}`);
});

async function shutdown(signal) {
    console.log(`\n${signal}: shutting down frontend...`);
    server.close(async () => {
        process.exit(0);
    });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
