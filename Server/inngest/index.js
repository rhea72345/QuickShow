import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

export const inngest = new Inngest({
  id: "movie-ticket-booking",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

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
      primaryEmail?.email_address ?? email_addresses?.[0]?.email_address ?? "",
    name: [first_name, last_name].filter(Boolean).join(" ") || "User",
    image: image_url ?? "",
  };
};

const syncUserCreation = inngest.createFunction(
  {
    id: "sync-user-from-clerk",
    triggers: [{ event: "clerk/user.created" }],
  },
  async ({ event, step }) => {
    const userData = buildUserData(event.data);

    await step.run("upsert-user", async () => {
      await User.findByIdAndUpdate(userData._id, userData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    });
  }
);

const syncUserDeletion = inngest.createFunction(
  {
    id: "delete-user-with-clerk",
    triggers: [{ event: "clerk/user.deleted" }],
  },
  async ({ event, step }) => {
    await step.run("delete-user", async () => {
      await User.findByIdAndDelete(event.data.id);
    });
  }
);

const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-from-clerk",
    triggers: [{ event: "clerk/user.updated" }],
  },
  async ({ event, step }) => {
    const userData = buildUserData(event.data);

    await step.run("update-user", async () => {
      await User.findByIdAndUpdate(userData._id, userData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    });
  }
);

const releaseSeatsAndDeleteBooking = inngest.createFunction(
  {
    id: "release-seats-delete-booking",
    event: "app/checkpayment",
  },
  async ({ event, step }) => {
    const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);

    await step.sleepUntil("wait-for-10-minutes", tenMinutesLater);

    await step.run("check-payment-status", async () => {
      const bookingId = event.data.bookingId;

      const booking = await Booking.findById(bookingId);

      if (!booking) return;

      // Change these field names if your schema uses different names
      if (!booking.isPaid) {
        const show = await Show.findById(booking.show);

        if (!show) return;

        booking.bookedSeats.forEach((seat) => {
          delete show.occupiedSeats[seat];
        });

        show.markModified("occupiedSeats");
        await show.save();

        await Booking.findByIdAndDelete(booking._id);
      }
    });
  }
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
];