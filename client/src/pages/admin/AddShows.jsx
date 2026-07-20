import React, { useEffect, useState } from "react";
import {
  StarIcon,
  CheckIcon,
  DeleteIcon,
} from "lucide-react";

import {
  dummyShowsData, // Agar assets.js me naam alag hai to wahi use karo
} from "../../assets/assets";

import Loading from "../../components/Loading";
import Title from "../../components/admin/Title";
import kConverter from "../../lib/kConverter";

const AddShows = () => {
  const currency = import.meta.env.VITE_CURRENCY;

  const [nowPlayingMovies, setNowPlayingMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [dateTimeSelection, setDateTimeSelection] = useState({});
  const [dateTimeInput, setDateTimeInput] = useState("");
  const [showPrice, setShowPrice] = useState("");

  const fetchNowPlayingMovies = async () => {
    setNowPlayingMovies(dummyShowsData);
  };

  useEffect(() => {
    fetchNowPlayingMovies();
  }, []);

  const handleDateTimeAdd = () => {
    if (!dateTimeInput) return;

    const [date, time] = dateTimeInput.split("T");

    if (!date || !time) return;

    setDateTimeSelection((prev) => {
      const times = prev[date] || [];

      if (!times.includes(time)) {
        return {
          ...prev,
          [date]: [...times, time],
        };
      }

      return prev;
    });
  };

  const handleRemoveTime = (date, time) => {
    setDateTimeSelection((prev) => {
      const filtered = prev[date].filter((t) => t !== time);

      if (filtered.length === 0) {
        const { [date]: removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [date]: filtered,
      };
    });
  };

  return nowPlayingMovies.length > 0 ? (
    <>
      <Title text1="Add" text2="Shows" />

      <p className="mt-10 text-lg font-medium">
        Now Playing Movies
      </p>

      <div className="overflow-x-auto pb-4">
        <div className="group flex flex-wrap gap-4 mt-4 w-max">

          {nowPlayingMovies.map((movie) => (

            <div
              key={movie.id}
              onClick={() => setSelectedMovie(movie.id)}
              className="relative max-w-40 cursor-pointer hover:-translate-y-1 transition duration-300"
            >
              <div className="relative rounded-lg overflow-hidden">

                <img
                  src={movie.poster_path}
                  alt={movie.title}
                  className="w-full object-cover brightness-90"
                />

                <div className="absolute bottom-0 left-0 w-full bg-black/70 p-2 flex justify-between text-sm">

                  <p className="flex items-center gap-1 text-gray-300">
                    <StarIcon
                      className="w-4 h-4 text-primary fill-primary"
                    />
                    {movie.vote_average.toFixed(1)}
                  </p>

                  <p className="text-gray-300">
                    {kConverter(movie.vote_count)} Votes
                  </p>

                </div>

              </div>

              {selectedMovie === movie.id && (
                <div className="absolute top-2 right-2 bg-primary rounded-full p-1">
                  <CheckIcon className="w-4 h-4 text-white" />
                </div>
              )}

              <p className="font-medium truncate mt-2">
                {movie.title}
              </p>

              <p className="text-gray-400 text-sm">
                {movie.release_date}
              </p>

            </div>

          ))}

        </div>
      </div>

      <div className="mt-8">
        <label className="block mb-2 font-medium">
          Show Price
        </label>

        <div className="inline-flex items-center gap-2 border border-gray-600 px-3 py-2 rounded">

          <span>{currency}</span>

          <input
            type="number"
            min={0}
            value={showPrice}
            onChange={(e) => setShowPrice(e.target.value)}
            placeholder="Enter show price"
            className="outline-none bg-transparent"
          />

        </div>
      </div>

      <div className="mt-8">

        <label className="block mb-2 font-medium">
          Select Date & Time
        </label>

        <div className="flex gap-3">

          <input
            type="datetime-local"
            value={dateTimeInput}
            onChange={(e) => setDateTimeInput(e.target.value)}
            className="border border-gray-600 px-3 py-2 rounded"
          />

          <button
            onClick={handleDateTimeAdd}
            className="bg-primary text-white px-4 rounded"
          >
            Add Time
          </button>

        </div>

        {Object.keys(dateTimeSelection).map((date) => (
          <div key={date} className="mt-4">

            <p className="font-medium">{date}</p>

            <div className="flex gap-2 flex-wrap mt-2">

              {dateTimeSelection[date].map((time) => (
                <button
                  key={time}
                  onClick={() => handleRemoveTime(date, time)}
                  className="bg-primary/20 px-3 py-1 rounded"
                >
                  {time} 
                </button>
              ))}

            </div>

          </div>
        ))}

      </div>
        {/*Display Selected Times*/}
          {Object.keys(dateTimeSelection).length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2"> Selected Date-Time</h2>
              <ul className="space-y-3">
                {Object.entries(dateTimeSelection).map(([date,times]) =>(
                  <li key={date}>
                    <div className="font-medium">{date}</div>
                    <div className="flex flex-wrap gap-2 mt-1 text-sm">
                      {times.map((time) => (
                        <div key={time} className="border border-primary px-2 py-1 flex items-center rounded">
                          <span>{time}</span>
                          <DeleteIcon onClick={() => handleRemoveTime(date,time)} width={15} className="ml-2 text-red-500 hover:text-red-700 cursor-pointer"/>
                        </div>
                      ))}
                    </div>
                  </li>
                ))}

              </ul>
            </div>
          )}
          <button className="bg-primary text-white px-8 py-2 mt-6 rounded hover:bg-primary/90 transition-all cursor-pointer">
          Add Show
          </button>


    </>
  ) : (
    <Loading />
  );
};

export default AddShows;