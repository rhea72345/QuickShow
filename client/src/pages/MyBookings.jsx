import React, { useEffect, useState } from "react";
import BlurCircle from "../components/BlurCircle";
import Loading from "../components/Loading";
import { dummyBookingData } from "../assets/assets";
import dateFormat from "../lib/dateFormat";

const MyBookings = () => {
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getMyBookings = () => {
    try {
      const savedBooking = JSON.parse(localStorage.getItem("newBooking"));

      if (savedBooking) {
        setBookings([savedBooking, ...dummyBookingData]);
      } else {
        setBookings(dummyBookingData);
      }
    } catch (error) {
      console.log(error);
      setBookings(dummyBookingData);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    getMyBookings();
  }, []);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="relative px-6 md:px-16 lg:px-40 pt-30 md:pt-40 min-h-[80vh]">

      <BlurCircle top="100px" left="100px" />
      <BlurCircle bottom="0px" left="600px" />

      <h1 className="text-3xl font-bold mb-8">
        My Bookings
      </h1>

      {bookings.length > 0 ? (
        bookings.map((item, index) => (
          <div
            key={index}
            className="flex flex-col md:flex-row justify-between bg-primary/10 border border-primary/20 rounded-xl p-4 mb-6"
          >
            {/* Left */}

            <div className="flex flex-col md:flex-row gap-4">

              <img
                src={item.show.movie.poster_path}
                alt={item.show.movie.title}
                className="w-44 rounded-lg object-cover"
              />

              <div className="flex flex-col">

                <h2 className="text-2xl font-semibold">
                  {item.show.movie.title}
                </h2>

                <p className="text-gray-400 mt-2">
                  Runtime : {item.show.movie.runtime} mins
                </p>

                <p className="text-gray-400">
                  Date : {dateFormat(item.show.showDateTime)}
                </p>

                <p className="text-gray-400">
                  Seats : {item.bookedSeats.join(", ")}
                </p>

              </div>

            </div>

            {/* Right */}

            <div className="flex flex-col justify-between mt-6 md:mt-0 md:items-end">

              <h2 className="text-3xl font-bold text-primary">
                {currency}
                {item.amount}
              </h2>

              <p className="text-gray-400 mt-3">
                Total Tickets : {item.bookedSeats.length}
              </p>

              {item.isPaid ? (
                <button className="bg-green-600 text-white px-6 py-2 rounded-full mt-4">
                  Paid
                </button>
              ) : (
                <button className="bg-primary text-white px-6 py-2 rounded-full mt-4 hover:opacity-90">
                  Pay Now
                </button>
              )}

            </div>

          </div>
        ))
      ) : (
        <div className="text-center text-gray-400 py-20 text-xl">
          No Bookings Found
        </div>
      )}

    </div>
  );
};

export default MyBookings;