const express = require("express");
const { BackendApiError, requestApi } = require("../lib/backendApi");

const webRouter = express.Router();
const PAGE_SIZE = 24;

function queryString(values) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
            params.set(key, String(value));
        }
    }
    return params.toString();
}

function responseStatus(error) {
    return error instanceof BackendApiError && error.status >= 400 && error.status < 500
        ? error.status
        : 502;
}

function normalizeMovieForm(body) {
    return {
        title: String(body.title || "").trim(),
        year: body.year,
        rating: body.rating,
        director: body.director,
        duration: body.duration,
        cast: body.cast,
        genres: Array.isArray(body.genres) ? body.genres : body.genres ? [body.genres] : [],
        description: body.description,
        thumbnail: String(body.thumbnailUrl || "").trim()
    };
}

async function loadGenres() {
    const result = await requestApi("/genres");
    return result.data;
}

webRouter.get("/", async (req, res) => {
    const filters = {
        q: String(req.query.q || "").trim(),
        searchType: String(req.query.searchType || "all").trim(),
        genre: String(req.query.genre || "").trim(),
        year: String(req.query.year || "").trim(),
        cast: String(req.query.cast || "").trim(),
        sortBy: String(req.query.sortBy || "year_desc").trim()
    };
    const requestedPage = Number.parseInt(req.query.page, 10);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1;
    const pageTitle = filters.q
        ? `Search: "${filters.q}"`
        : filters.genre && filters.genre.toLowerCase() !== "all"
            ? `${filters.genre} Movies`
            : filters.year
                ? `Movies released in ${filters.year}`
                : filters.cast
                    ? `Movies starring ${filters.cast}`
                    : filters.sortBy === "top_rated" || filters.sortBy === "rating"
                        ? "Top Rated Movies"
                        : "Explore Movies";

    try {
        const movieQuery = queryString({ ...filters, page, pageSize: PAGE_SIZE });
        const featuredQuery = queryString({ page: 1, pageSize: 4, sortBy: "top_rated" });
        const [movieResult, statsResult, genresResult, featuredResult] = await Promise.all([
            requestApi(`/movies?${movieQuery}`),
            requestApi("/stats"),
            requestApi("/genres"),
            requestApi(`/movies?${featuredQuery}`)
        ]);
        const totalPages = Math.max(1, Math.ceil(movieResult.total / PAGE_SIZE));
        if (page > totalPages) {
            const lastPageQuery = queryString({ ...filters, page: totalPages });
            return res.redirect(`/?${lastPageQuery}`);
        }
        const paginationQuery = queryString(filters);

        return res.render("pages/movies/index", {
            movies: movieResult.data,
            query: filters.q,
            searchType: filters.searchType,
            genre: filters.genre,
            year: filters.year,
            cast: filters.cast,
            sortBy: filters.sortBy,
            pageTitle,
            page,
            pageSize: PAGE_SIZE,
            totalMovies: movieResult.total,
            totalPages,
            paginationQuery,
            availableGenres: genresResult.data,
            stats: statsResult.data,
            featuredMovies: featuredResult.data,
            alert: req.query.alert || null,
            errorMessage: req.query.error || null
        });
    } catch (error) {
        console.error("Frontend catalog request failed:", error.message);
        return res.status(502).render("pages/movies/index", {
            movies: [],
            query: filters.q,
            searchType: filters.searchType,
            genre: filters.genre,
            year: filters.year,
            cast: filters.cast,
            sortBy: filters.sortBy,
            pageTitle: "CineSphere is temporarily unavailable",
            page,
            pageSize: PAGE_SIZE,
            totalMovies: 0,
            totalPages: 1,
            paginationQuery: queryString(filters),
            availableGenres: [],
            stats: null,
            featuredMovies: [],
            alert: null,
            errorMessage: "The movie service is temporarily unavailable. Please try again."
        });
    }
});

webRouter.get("/movies", (req, res) => res.redirect("/"));

webRouter.get("/movies/create", async (req, res) => {
    try {
        return res.render("pages/movies/createForm", {
            pageTitle: "Add New Movie",
            availableGenres: await loadGenres(),
            errorMessage: null
        });
    } catch (error) {
        console.error("Could not load genres for movie form:", error.message);
        return res.status(502).render("pages/movies/createForm", {
            pageTitle: "Add New Movie",
            availableGenres: [],
            errorMessage: "Could not load genres from the movie service."
        });
    }
});

webRouter.post("/movies", async (req, res) => {
    try {
        const result = await requestApi("/movies", {
            method: "POST",
            body: JSON.stringify(normalizeMovieForm(req.body))
        });
        return res.redirect(`/movies/show/${encodeURIComponent(result.data._id)}?alert=created`);
    } catch (error) {
        console.error("Could not create movie:", error.message);
        let availableGenres = [];
        try {
            availableGenres = await loadGenres();
        } catch (genreError) {
            console.error("Could not reload genres for movie form:", genreError.message);
        }
        return res.status(responseStatus(error)).render("pages/movies/createForm", {
            pageTitle: "Add New Movie",
            availableGenres,
            errorMessage: error.message
        });
    }
});

webRouter.get("/movies/show/:id", async (req, res) => {
    try {
        const movieResult = await requestApi(`/movies/${encodeURIComponent(req.params.id)}`);
        const relatedResult = await requestApi(
            `/movies/${encodeURIComponent(req.params.id)}/recommendations`
        );
        return res.render("pages/movies/show", {
            movie: movieResult.data,
            relatedMovies: relatedResult.data,
            pageTitle: `${movieResult.data.title} (${movieResult.data.year})`,
            alert: req.query.alert || null
        });
    } catch (error) {
        if (error.status === 404) {
            return res.status(404).render("pages/movies/show", {
                movie: null,
                relatedMovies: [],
                pageTitle: "Movie Not Found",
                alert: null
            });
        }
        console.error("Could not load movie details:", error.message);
        return res.status(502).render("pages/movies/show", {
            movie: null,
            relatedMovies: [],
            pageTitle: "Movie service unavailable",
            alert: null
        });
    }
});

webRouter.get("/movies/edit/:id", async (req, res) => {
    try {
        const [movieResult, availableGenres] = await Promise.all([
            requestApi(`/movies/${encodeURIComponent(req.params.id)}`),
            loadGenres()
        ]);
        return res.render("pages/movies/updateForm", {
            movie: movieResult.data,
            availableGenres,
            pageTitle: `Edit: ${movieResult.data.title}`,
            errorMessage: null
        });
    } catch (error) {
        if (error.status === 404) {
            return res.status(404).render("pages/movies/show", {
                movie: null,
                relatedMovies: [],
                pageTitle: "Movie Not Found",
                alert: null
            });
        }
        console.error("Could not load movie edit form:", error.message);
        return res.status(502).send("Could not load the movie edit form.");
    }
});

webRouter.post("/movies/update", async (req, res) => {
    const id = String(req.body.id || "").trim();

    try {
        const existingResult = await requestApi(`/movies/${encodeURIComponent(id)}`);
        const movie = normalizeMovieForm(req.body);
        if (!movie.thumbnail) {
            movie.thumbnail = existingResult.data.thumbnail || "";
        }
        const result = await requestApi(`/movies/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(movie)
        });
        return res.redirect(`/movies/show/${encodeURIComponent(result.data._id)}?alert=updated`);
    } catch (error) {
        console.error("Could not update movie:", error.message);
        if (error.status === 404) {
            return res.status(404).send("Movie not found.");
        }
        return res.status(responseStatus(error)).send(error.message);
    }
});

webRouter.post("/movies/delete/:id", async (req, res) => {
    try {
        await requestApi(`/movies/${encodeURIComponent(req.params.id)}`, {
            method: "DELETE"
        });
        return res.redirect("/?alert=deleted");
    } catch (error) {
        console.error("Could not delete movie:", error.message);
        return res.status(responseStatus(error)).send(error.message);
    }
});

module.exports = webRouter;
