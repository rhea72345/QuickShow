import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Show.js";

// API to get now playing movies
export const getNowPlayingMovies = async (req, res) => {
  try {
    const { data } = await axios.get(
      "https://api.themoviedb.org/3/movie/now_playing",
      {
        headers: {
          Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
        },
      }
    );

    res.json({
      success: true,
      movies: data.results,
    });
  } catch (error) {
    console.log("========= TMDB ERROR =========");
    console.log(error.response?.data || error.message);

    res.json({
      success: false,
      message: error.response?.data?.status_message || error.message,
    });
  }
};

// API to add new show
export const addShow = async (req, res) => {
  try {
    const { movieId, showsInput, showPrice } = req.body;

    let movie = await Movie.findById(movieId);

    if (!movie) {
      const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
        axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
          headers: {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          },
        }),

        axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
          headers: {
            Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
          },
        }),
      ]);

      const movieApiData = movieDetailsResponse.data;
      const movieCreditsData = movieCreditsResponse.data;

      movie = await Movie.create({
        _id: movieId,
        title: movieApiData.title,
        overview: movieApiData.overview,
        poster_path: movieApiData.poster_path,
        backdrop_path: movieApiData.backdrop_path,
        release_date: movieApiData.release_date,
        original_language: movieApiData.original_language,
        tagline: movieApiData.tagline || "",
        genres: movieApiData.genres,
        casts: movieCreditsData.cast,
        vote_average: movieApiData.vote_average,
        runtime: movieApiData.runtime,
      });
    }

    const showsToCreate = [];

    showsInput.forEach((show) => {
      show.time.forEach((time) => {
        showsToCreate.push({
          movie: movie._id,
          showDateTime: new Date(`${show.date}T${time}`),
          showPrice,
          occupiedSeats: {},
        });
      });
    });

    if (showsToCreate.length > 0) {
      await Show.insertMany(showsToCreate);
    }

    res.json({
      success: true,
      message: "Show Added Successfully.",
    });
  } catch (error) {
    console.log("========= FULL ERROR =========");
    console.log(error.response?.data || error);
    console.dir(error, { depth: null });

    res.json({
      success: false,
      message: error.response?.data?.status_message || error.message,
    });
  }
};