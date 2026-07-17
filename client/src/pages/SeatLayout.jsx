import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const SeatLayout = () => {
  const { id, date } = useParams();
  const navigate = useNavigate();

  const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const cols = 9;

  const seatPrice = 250;

  const timings = [
    "09:30 AM",
    "12:30 PM",
    "03:30 PM",
    "06:30 PM",
    "09:30 PM",
  ];

  // Dummy Booked Seats
  const bookedSeats = [
    "A2",
    "A5",
    "B4",
    "B8",
    "C1",
    "C7",
    "D5",
    "E3",
    "F6",
    "G2",
    "H9",
  ];

  const [selectedSeats, setSelectedSeats] = useState([]);
  const [selectedTime, setSelectedTime] = useState("");

  const toggleSeat = (seat) => {
    if (bookedSeats.includes(seat)) return;

    if (selectedSeats.includes(seat)) {
      setSelectedSeats(selectedSeats.filter((s) => s !== seat));
      return;
    }

    if (selectedSeats.length >= 5) {
      alert("You can select only 5 seats.");
      return;
    }

    setSelectedSeats([...selectedSeats, seat]);
  };

  const totalAmount = selectedSeats.length * seatPrice;

  const handleCheckout = () => {
    const booking = {
      _id: Date.now().toString(),
      show: {
        _id: id,
        movie: {
          title: `Movie ${id}`,
          poster_path:
            "https://image.tmdb.org/t/p/original/dDlfjR7gllmr8HTeN6rfrYhTdwX.jpg",
          runtime: 120,
        },
        showDateTime: `${date} ${selectedTime}`,
        showPrice: seatPrice,
      },
      amount: totalAmount,
      bookedSeats: selectedSeats,
      isPaid: false,
    };

    localStorage.setItem("newBooking", JSON.stringify(booking));

    navigate("/my-bookings");
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white px-6 py-8">
      <div className="max-w-7xl mx-auto">

        <h1 className="text-4xl font-bold text-center mb-10">
          Select Your Seat
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">

          {/* LEFT : Available Timings */}

          <div className="bg-[#16161d] border border-pink-500/20 rounded-2xl p-6 h-fit">

            <h2 className="text-2xl font-semibold mb-6">
              Available Timings
            </h2>

            <div className="space-y-4">

              {timings.map((time) => (

                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`w-full py-3 rounded-lg font-medium transition ${
                    selectedTime === time
                      ? "bg-pink-600 text-white"
                      : "bg-[#262631] hover:bg-pink-500"
                  }`}
                >
                  {time}
                </button>

              ))}

            </div>
                        <div className="mt-8">

              <h3 className="font-semibold mb-4">
                Seat Status
              </h3>

              <div className="space-y-3 text-sm">

                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border border-white rounded"></div>
                  <span>Available</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-pink-600"></div>
                  <span>Selected</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-gray-700"></div>
                  <span>Booked</span>
                </div>

              </div>

            </div>

          </div>

          {/* RIGHT : Seat Layout */}

          <div className="lg:col-span-2 bg-[#16161d] border border-pink-500/20 rounded-2xl p-8">

            <div className="w-full h-3 rounded-full bg-pink-500"></div>

            <p className="text-center tracking-[8px] text-gray-400 mt-3 mb-10">
              SCREEN
            </p>

            <div className="flex flex-col items-center">

              {rows.map((row) => (
                <div
                  key={row}
                  className="flex gap-2 mb-2"
                >
                  {Array.from({ length: cols }, (_, index) => {

                    const seat = `${row}${index + 1}`;

                    const booked = bookedSeats.includes(seat);

                    const selected = selectedSeats.includes(seat);

                    return (
                      <button
                        key={seat}
                        disabled={booked}
                        onClick={() => toggleSeat(seat)}
                        className={`
                          w-11
                          h-11
                          rounded-md
                          text-sm
                          font-semibold
                          border
                          transition-all
                          duration-300
                          ${
                            booked
                              ? "bg-gray-700 border-gray-700 cursor-not-allowed"
                              : selected
                              ? "bg-pink-600 border-pink-600 text-white"
                              : "border-pink-500 hover:bg-pink-500 hover:text-white"
                          }
                        `}
                      >
                        {seat}
                      </button>
                    );

                  })}
                </div>
              ))}

            </div>

            {/* Seat Status */}

            <div className="flex justify-center gap-8 mt-10 text-sm">

              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border border-white rounded"></div>
                Available
              </div>

              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-pink-600"></div>
                Selected
              </div>

              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-700"></div>
                Booked
              </div>

            </div>

          </div>

        </div>

        {/* Booking Summary */}

        <div className="mt-10 bg-[#16161d] border border-pink-500/20 rounded-2xl p-8">

          <h2 className="text-2xl font-bold mb-8">
            Booking Summary
          </h2>

          <div className="grid md:grid-cols-3 gap-6">

            <div className="bg-[#22222d] rounded-xl p-5">
              <p className="text-gray-400 text-sm">Movie ID</p>
              <p className="text-lg font-semibold mt-2">{id}</p>
            </div>

            <div className="bg-[#22222d] rounded-xl p-5">
              <p className="text-gray-400 text-sm">Show Date</p>
              <p className="text-lg font-semibold mt-2">{date}</p>
            </div>

            <div className="bg-[#22222d] rounded-xl p-5">
              <p className="text-gray-400 text-sm">Selected Time</p>
              <p className="text-lg font-semibold mt-2">
                {selectedTime || "Not Selected"}
              </p>
            </div>

            <div className="bg-[#22222d] rounded-xl p-5">
              <p className="text-gray-400 text-sm">Seat Price</p>
              <p className="text-lg font-semibold mt-2">
                ₹{seatPrice}
              </p>
            </div>

            <div className="bg-[#22222d] rounded-xl p-5">
              <p className="text-gray-400 text-sm">Total Seats</p>
              <p className="text-lg font-semibold mt-2">
                {selectedSeats.length}
              </p>
            </div>

            <div className="bg-[#22222d] rounded-xl p-5">
              <p className="text-gray-400 text-sm">Total Amount</p>
              <p className="text-2xl font-bold text-pink-500 mt-2">
                ₹{totalAmount}
              </p>
            </div>

          </div>
                    {/* Selected Seats */}

          <div className="mt-8">

            <h3 className="text-xl font-semibold mb-4">
              Selected Seats
            </h3>

            {selectedSeats.length > 0 ? (

              <div className="flex flex-wrap gap-3">

                {selectedSeats.map((seat) => (

                  <span
                    key={seat}
                    className="px-4 py-2 rounded-lg bg-pink-600 text-white font-semibold"
                  >
                    {seat}
                  </span>

                ))}

              </div>

            ) : (

              <p className="text-gray-400">
                No seats selected.
              </p>

            )}

          </div>

          {/* Booking Rules */}

          <div className="mt-8 bg-[#22222d] rounded-xl p-5">

            <h3 className="text-lg font-semibold mb-4">
              Booking Rules
            </h3>

            <ul className="space-y-3 text-gray-400 list-disc pl-5">
              <li>You can select only 5 seats.</li>
              <li>Please select a show timing before checkout.</li>
              <li>Booked seats cannot be selected.</li>
              <li>Tickets once booked are non-refundable.</li>
            </ul>

          </div>

        </div>

        {/* Checkout Button */}

        <div className="flex justify-center mt-10">

          <button
            type="button"
            disabled={selectedSeats.length === 0 || !selectedTime}
            onClick={handleCheckout}
            className={`px-14 py-4 rounded-xl text-lg font-semibold transition-all duration-300 ${
              selectedSeats.length > 0 && selectedTime
                ? "bg-pink-600 hover:bg-pink-700 cursor-pointer text-white"
                : "bg-gray-700 cursor-not-allowed text-gray-400"
            }`}
          >
            Proceed To Checkout
          </button>

        </div>

      </div>
    </div>
  );
};

export default SeatLayout;