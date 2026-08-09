import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

export const inngest = new Inngest({
  id: "movie-ticket-booking",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// ======================================================
// Helper function
// ======================================================

const buildUserData = ({
  id,
  first_name,
  last_name,
  email_addresses,
  image_url,
  primary_email_address_id,
}) => {
  const primaryEmail = email_addresses?.find(
    (email) => email.id === primary_email_address_id
  );

  return {
    _id: id,

    email:
      primaryEmail?.email_address ??
      email_addresses?.[0]?.email_address ??
      "",

    name:
      [first_name, last_name]
        .filter(Boolean)
        .join(" ") || "User",

    image: image_url ?? "",
  };
};

// ======================================================
// 1. CREATE USER
// ======================================================

const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: {
      event: "clerk/user.created",
    },
  },

  async ({ event, step }) => {
    const userData = buildUserData(event.data);

    await step.run("upsert-user", async () => {
      await User.findByIdAndUpdate(
        userData._id,
        userData,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    });
  }
);

// ======================================================
// 2. DELETE USER
// ======================================================

const syncUserDeletion = inngest.createFunction(
  {
    id: "delete-user-with-clerk",
    triggers: {
      event: "clerk/user.deleted",
    },
  },

  async ({ event, step }) => {
    await step.run("delete-user", async () => {
      await User.findByIdAndDelete(event.data.id);
    });
  }
);

// ======================================================
// 3. UPDATE USER
// ======================================================

const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-from-clerk",
    triggers: {
      event: "clerk/user.updated",
    },
  },

  async ({ event, step }) => {
    const userData = buildUserData(event.data);

    await step.run("update-user", async () => {
      await User.findByIdAndUpdate(
        userData._id,
        userData,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );
    });
  }
);

// ======================================================
// 4. RELEASE SEATS + DELETE UNPAID BOOKING
// ======================================================

const releaseSeatsAndDeleteBooking =
  inngest.createFunction(
    {
      id: "release-seats-delete-booking",

      triggers: {
        event: "app/checkpayment",
      },
    },

    async ({ event, step }) => {
      const bookingId = event.data.bookingId;

      // ================================================
      // Wait 10 minutes
      // ================================================

      await step.sleep(
        "wait-for-10-minutes",
        "10m"
      );

      // ================================================
      // Check payment
      // ================================================

      await step.run(
        "check-payment-status",
        async () => {
          const booking =
            await Booking.findById(bookingId);

          // Booking not found
          if (!booking) {
            console.log(
              "Booking not found:",
              bookingId
            );

            return;
          }

          // Payment already completed
          if (booking.isPaid) {
            console.log(
              "Payment already completed:",
              bookingId
            );

            return;
          }

          // ============================================
          // Find show
          // ============================================

          const show = await Show.findById(
            booking.show
          );

          if (!show) {
            console.log(
              "Show not found:",
              booking.show
            );

            return;
          }

          // ============================================
          // Release seats
          // ============================================

          booking.bookedSeats.forEach((seat) => {
            delete show.occupiedSeats[seat];
          });

          show.markModified("occupiedSeats");

          await show.save();

          console.log(
            "Seats released:",
            booking.bookedSeats
          );

          // ============================================
          // Delete unpaid booking
          // ============================================

          await Booking.findByIdAndDelete(
            booking._id
          );

          console.log(
            "Unpaid booking deleted:",
            booking._id
          );
        }
      );
    }
  );

// ======================================================
// EXPORT ALL FUNCTIONS
// ======================================================

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
];