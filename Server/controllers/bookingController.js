import { getAuth } from "@clerk/express";
import { inngest } from "../inngest/index.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";
import stripe from "stripe";

// ======================================================
// Helper: Release Seats
// ======================================================

const releaseSeats = (showData, seats) => {
  seats.forEach((seat) => {
    delete showData.occupiedSeats[seat];
  });

  showData.markModified("occupiedSeats");
};

// ======================================================
// Helper: Cleanup Stale Seats
// ======================================================

const cleanupStaleSeats = async (showData) => {
  const occupiedEntries = Object.entries(
    showData.occupiedSeats || {}
  );

  if (!occupiedEntries.length) {
    return false;
  }

  let modified = false;

  for (const [seat] of occupiedEntries) {
    const activeBooking = await Booking.findOne({
      show: showData._id.toString(),
      bookedSeats: seat,
      isPaid: false,
      paymentLink: {
        $exists: true,
        $ne: null,
      },
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

// ======================================================
// Helper: Check Seat Availability
// ======================================================

const checkSeatsAvailability = async (
  showId,
  selectedSeats
) => {
  try {
    const showData = await Show.findById(showId);

    if (!showData) {
      return false;
    }

    await cleanupStaleSeats(showData);

    const isAnySeatTaken = selectedSeats.some(
      (seat) => showData.occupiedSeats[seat]
    );

    return !isAnySeatTaken;
  } catch (error) {
    console.error(
      "Seat availability error:",
      error.message
    );

    return false;
  }
};

// ======================================================
// 1. CREATE BOOKING
// ======================================================

export const createBooking = async (req, res) => {
  let booking = null;
  let showData = null;
  let selectedSeats = [];
  let showId = null;

  try {
    const { userId } = getAuth(req);

    ({ showId, selectedSeats } = req.body);

    const origin =
      req.headers.origin ||
      process.env.CLIENT_URL ||
      "http://localhost:5173";

    // --------------------------------------------------
    // Authentication
    // --------------------------------------------------

    if (!userId) {
      return res.json({
        success: false,
        message: "Unauthorized.",
      });
    }

    // --------------------------------------------------
    // Validate Request
    // --------------------------------------------------

    if (!showId || !selectedSeats?.length) {
      return res.json({
        success: false,
        message: "Show and seats are required.",
      });
    }

    // --------------------------------------------------
    // Check Seat Availability
    // --------------------------------------------------

    const isAvailable =
      await checkSeatsAvailability(
        showId,
        selectedSeats
      );

    if (!isAvailable) {
      return res.json({
        success: false,
        message:
          "Selected Seats are not available.",
      });
    }

    // --------------------------------------------------
    // Find Show
    // --------------------------------------------------

    showData = await Show.findById(showId).populate(
      "movie"
    );

    if (!showData) {
      return res.json({
        success: false,
        message: "Show not found.",
      });
    }

    // --------------------------------------------------
    // Create Booking
    // --------------------------------------------------

    booking = await Booking.create({
      user: userId,
      show: showId,
      amount:
        showData.showPrice *
        selectedSeats.length,
      bookedSeats: selectedSeats,
    });

    console.log(
      "✅ Booking created:",
      booking._id.toString()
    );

    // --------------------------------------------------
    // Occupy Seats
    // --------------------------------------------------

    selectedSeats.forEach((seat) => {
      showData.occupiedSeats[seat] = userId;
    });

    showData.markModified("occupiedSeats");

    await showData.save();

    // --------------------------------------------------
    // Stripe
    // --------------------------------------------------

    const stripeInstance = new stripe(
      process.env.STRIPE_SECRET_KEY
    );

    const line_items = [
      {
        price_data: {
          currency: "usd",

          product_data: {
            name: showData.movie.title,
          },

          unit_amount:
            Math.floor(booking.amount) * 100,
        },

        quantity: 1,
      },
    ];

    // --------------------------------------------------
    // Create Stripe Checkout Session
    // --------------------------------------------------

    const session =
      await stripeInstance.checkout.sessions.create({
        success_url:
          `${origin}/loading/my-bookings` +
          `?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${origin}/my-bookings`,

        line_items,

        mode: "payment",

        metadata: {
          bookingId:
            booking._id.toString(),
        },

        expires_at:
          Math.floor(Date.now() / 1000) +
          30 * 60,
      });

    // --------------------------------------------------
    // Save Payment Link
    // --------------------------------------------------

    booking.paymentLink = session.url;

    await booking.save();

    console.log(
      "✅ Stripe payment link saved"
    );

    // ==================================================
    // INNGEST - RELEASE SEATS AFTER 10 MINUTES
    // ==================================================

    try {
      const result = await inngest.send({
        name: "app/checkpayment",

        data: {
          bookingId:
            booking._id.toString(),
        },
      });

      console.log(
        "✅ INNGEST CHECKPAYMENT EVENT SENT:",
        result
      );
    } catch (inngestError) {
      console.error(
        "❌ INNGEST CHECKPAYMENT EVENT FAILED:",
        inngestError.message
      );
    }

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    return res.json({
      success: true,
      url: session.url,
    });

  } catch (error) {
    console.error(
      "Create booking error:",
      error.message
    );

    // --------------------------------------------------
    // Delete Booking If Error
    // --------------------------------------------------

    if (booking?._id) {
      await Booking.findByIdAndDelete(
        booking._id
      ).catch(() => {});
    }

    // --------------------------------------------------
    // Release Seats If Error
    // --------------------------------------------------

    if (
      showData &&
      selectedSeats.length
    ) {
      releaseSeats(
        showData,
        selectedSeats
      );

      await showData
        .save()
        .catch(() => {});
    }

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// 2. VERIFY PAYMENT
// ======================================================

export const verifyPayment = async (
  req,
  res
) => {
  try {
    const { sessionId } = req.body;

    const { userId } = getAuth(req);

    // --------------------------------------------------
    // Authentication
    // --------------------------------------------------

    if (!userId) {
      return res.json({
        success: false,
        message: "Unauthorized.",
      });
    }

    // --------------------------------------------------
    // Validate Session ID
    // --------------------------------------------------

    if (!sessionId) {
      return res.json({
        success: false,
        message:
          "Session ID is required.",
      });
    }

    // --------------------------------------------------
    // Stripe Instance
    // --------------------------------------------------

    const stripeInstance = new stripe(
      process.env.STRIPE_SECRET_KEY
    );

    // --------------------------------------------------
    // Retrieve Stripe Session
    // --------------------------------------------------

    const session =
      await stripeInstance.checkout.sessions.retrieve(
        sessionId
      );

    // --------------------------------------------------
    // Check Payment
    // --------------------------------------------------

    if (
      session.payment_status !== "paid"
    ) {
      return res.json({
        success: false,
        message:
          "Payment not completed.",
      });
    }

    // --------------------------------------------------
    // Get Booking ID
    // --------------------------------------------------

    const { bookingId } =
      session.metadata || {};

    if (!bookingId) {
      return res.json({
        success: false,
        message:
          "Booking ID not found in session.",
      });
    }

    console.log(
      "💳 Payment verified for booking:",
      bookingId
    );

    // --------------------------------------------------
    // Find Booking
    // --------------------------------------------------

    const booking =
      await Booking.findById(bookingId);

    if (
      !booking ||
      booking.user !== userId
    ) {
      return res.json({
        success: false,
        message:
          "Booking not found.",
      });
    }

    // --------------------------------------------------
    // Mark Booking Paid
    // --------------------------------------------------

    await Booking.findByIdAndUpdate(
      bookingId,
      {
        isPaid: true,

        $unset: {
          paymentLink: "",
        },
      }
    );

    console.log(
      "✅ Booking marked as paid:",
      bookingId
    );

    // ==================================================
    // INNGEST - SEND BOOKING CONFIRMATION EMAIL
    // ==================================================

    try {
      const emailEvent =
        await inngest.send({
          name:
            "app/send-booking-confirmation-email",

          data: {
            bookingId:
              bookingId.toString(),
          },
        });

      console.log(
        "✅ BOOKING CONFIRMATION EMAIL EVENT SENT:",
        emailEvent
      );
    } catch (inngestError) {
      console.error(
        "❌ BOOKING CONFIRMATION EMAIL EVENT FAILED:",
        inngestError.message
      );
    }

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    return res.json({
      success: true,
      message:
        "Payment verified successfully.",
    });

  } catch (error) {
    console.error(
      "Verify payment error:",
      error.message
    );

    return res.json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// 3. GET OCCUPIED SEATS
// ======================================================

export const getOccupiedSeats = async (
  req,
  res
) => {
  try {
    const { showId } = req.params;

    // --------------------------------------------------
    // Find Show
    // --------------------------------------------------

    const showData =
      await Show.findById(showId);

    if (!showData) {
      return res.json({
        success: false,
        message: "Show not found.",
      });
    }

    // --------------------------------------------------
    // Cleanup Stale Seats
    // --------------------------------------------------

    await cleanupStaleSeats(
      showData
    );

    // --------------------------------------------------
    // Get Occupied Seats
    // --------------------------------------------------

    const occupiedSeats =
      Object.keys(
        showData.occupiedSeats
      );

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    return res.json({
      success: true,
      occupiedSeats,
    });

  } catch (error) {
    console.error(
      "Get occupied seats error:",
      error.message
    );

    return res.json({
      success: false,
      message: error.message,
    });
  }
};