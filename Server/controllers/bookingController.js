import { getAuth } from "@clerk/express";
import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import stripe from "stripe";

const releaseSeats = (showData, seats) => {
  seats.forEach((seat) => {
    delete showData.occupiedSeats[seat];
  });
  showData.markModified("occupiedSeats");
};

const cleanupStaleSeats = async (showData) => {
  const occupiedEntries = Object.entries(showData.occupiedSeats || {});
  if (!occupiedEntries.length) return false;

  let modified = false;

  for (const [seat] of occupiedEntries) {
    const activeBooking = await Booking.findOne({
      show: showData._id.toString(),
      bookedSeats: seat,
      isPaid: false,
      paymentLink: { $exists: true, $ne: null },
    });

    if (!activeBooking) {
      delete showData.occupiedSeats[seat];
      modified = true;
    }
  }

  if (modified) {
    showData.markModified("occupiedSeats");
    await showData.save();
  }

  return modified;
};

const checkSeatsAvailability = async (showId, selectedSeats) => {
  try {
    const showData = await Show.findById(showId);
    if (!showData) return false;

    await cleanupStaleSeats(showData);

    const isAnySeatTaken = selectedSeats.some(
      (seat) => showData.occupiedSeats[seat]
    );

    return !isAnySeatTaken;
  } catch (error) {
    console.log(error.message);
    return false;
  }
};

export const createBooking = async (req, res) => {
  let booking = null;
  let showData = null;
  let selectedSeats = [];
  let showId = null;

  try {
    const { userId } = getAuth(req);
    ({ showId, selectedSeats } = req.body);
    const origin =
      req.headers.origin || process.env.CLIENT_URL || "http://localhost:5173";

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized." });
    }

    if (!showId || !selectedSeats?.length) {
      return res.json({
        success: false,
        message: "Show and seats are required.",
      });
    }

    const isAvailable = await checkSeatsAvailability(showId, selectedSeats);

    if (!isAvailable) {
      return res.json({
        success: false,
        message: "Selected Seats are not available.",
      });
    }

    showData = await Show.findById(showId).populate("movie");

    if (!showData) {
      return res.json({ success: false, message: "Show not found." });
    }

    booking = await Booking.create({
      user: userId,
      show: showId,
      amount: showData.showPrice * selectedSeats.length,
      bookedSeats: selectedSeats,
    });

    selectedSeats.forEach((seat) => {
      showData.occupiedSeats[seat] = userId;
    });
    showData.markModified("occupiedSeats");
    await showData.save();

    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

    const line_items = [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: showData.movie.title,
          },
          unit_amount: Math.floor(booking.amount) * 100,
        },
        quantity: 1,
      },
    ];

    const session = await stripeInstance.checkout.sessions.create({
      success_url: `${origin}/loading/my-bookings?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/my-bookings`,
      line_items,
      mode: "payment",
      metadata: {
        bookingId: booking._id.toString(),
      },
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    booking.paymentLink = session.url;
    await booking.save();

    // Run Inngest scheduler to release seats if payment isn't completed in 10 minutes
    try {
      await inngest.send({
        name: "app/checkpayment",
        data: {
          bookingId: booking._id.toString(),
        },
      });
    } catch (inngestError) {
      console.error("Inngest send failed:", inngestError.message);
    }

    res.json({ success: true, url: session.url });
  } catch (error) {
    console.log(error.message);

    if (booking?._id) {
      await Booking.findByIdAndDelete(booking._id).catch(() => {});
    }

    if (showData && selectedSeats.length) {
      releaseSeats(showData, selectedSeats);
      await showData.save().catch(() => {});
    }

    res.json({ success: false, message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const { userId } = getAuth(req);

    if (!userId) {
      return res.json({ success: false, message: "Unauthorized." });
    }

    if (!sessionId) {
      return res.json({ success: false, message: "Session ID is required." });
    }

    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.json({ success: false, message: "Payment not completed." });
    }

    const { bookingId } = session.metadata || {};

    if (!bookingId) {
      return res.json({
        success: false,
        message: "Booking ID not found in session.",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking || booking.user !== userId) {
      return res.json({ success: false, message: "Booking not found." });
    }

    await Booking.findByIdAndUpdate(bookingId, {
      isPaid: true,
      $unset: { paymentLink: "" },
    });

    res.json({ success: true, message: "Payment verified successfully." });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};

export const getOccupiedSeats = async (req, res) => {
  try {
    const { showId } = req.params;
    const showData = await Show.findById(showId);

    if (!showData) {
      return res.json({ success: false, message: "Show not found." });
    }

    await cleanupStaleSeats(showData);

    const occupiedSeats = Object.keys(showData.occupiedSeats);

    res.json({ success: true, occupiedSeats });
  } catch (error) {
    console.log(error.message);
    res.json({ success: false, message: error.message });
  }
};
