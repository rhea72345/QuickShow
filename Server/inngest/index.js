import { Inngest } from "inngest";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import Show from "../models/Show.js";

import { sendEmail } from "../configs/nodeMailer.js";

export const inngest = new Inngest({
  id: "movie-ticket-booking",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

// ======================================================
// Helper: Build User Data
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
      [first_name, last_name].filter(Boolean).join(" ") ||
      "User",

    image: image_url ?? "",
  };
};

// ======================================================
// 1. Sync User Creation
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
// 2. Sync User Deletion
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
// 3. Sync User Updation
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
// 4. Release Seats + Delete Unpaid Booking
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

      // Wait for 10 minutes
      await step.sleep(
        "wait-for-10-minutes",
        "10m"
      );

      await step.run(
        "check-payment-status",
        async () => {
          const booking =
            await Booking.findById(bookingId);

          // Booking doesn't exist
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
              "Booking already paid:",
              bookingId
            );

            return;
          }

          // Find show
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

          // Release seats
          booking.bookedSeats.forEach((seat) => {
            delete show.occupiedSeats[seat];
          });

          show.markModified("occupiedSeats");

          await show.save();

          console.log(
            "Seats released:",
            booking.bookedSeats
          );

          // Delete unpaid booking
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
// 5. Send Booking Confirmation Email
// ======================================================

const sendBookingConfirmationEmail =
  inngest.createFunction(
    {
      id: "send-booking-confirmation-email",

      triggers: {
        event: "app/send-booking-confirmation-email",
      },
    },

    async ({ event, step }) => {
      const bookingId = event.data.bookingId;

      await step.run(
        "send-confirmation-email",
        async () => {
          // Find booking
          const booking =
            await Booking.findById(bookingId);

          if (!booking) {
            console.log(
              "Booking not found:",
              bookingId
            );

            return;
          }

          // Find user
          const user = await User.findById(
            booking.user
          );

          if (!user) {
            console.log(
              "User not found:",
              booking.user
            );

            return;
          }

          if (!user.email) {
            console.log(
              "User email not found"
            );

            return;
          }

          // Find show
          const show = await Show.findById(
            booking.show
          );

          const movieName =
            show?.movie?.title ||
            show?.title ||
            "Movie";

          const seats =
            booking.bookedSeats?.join(", ") ||
            "N/A";

          // Send email
          await sendEmail({
            to: user.email,

            subject:
              "QuickShow - Booking Confirmation",

            body: `
              <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: auto;
                padding: 20px;
                border: 1px solid #ddd;
                border-radius: 10px;
              ">

                <h2 style="color: #f43f5e;">
                  Booking Confirmed 🎉
                </h2>

                <p>
                  Hello ${user.name || "User"},
                </p>

                <p>
                  Your movie booking has been
                  successfully confirmed.
                </p>

                <hr />

                <p>
                  <strong>Movie:</strong>
                  ${movieName}
                </p>

                <p>
                  <strong>Seats:</strong>
                  ${seats}
                </p>

                <p>
                  <strong>Booking ID:</strong>
                  ${bookingId}
                </p>

                <hr />

                <p>
                  Thank you for booking with
                  <strong>QuickShow</strong>.
                </p>

              </div>
            `,
          });

          console.log(
            `Confirmation email sent to ${user.email}`
          );
        }
      );
    }
  );

// ======================================================
// 6. Send Show Reminders
// ======================================================

const sendShowReminders =
  inngest.createFunction(
    {
      id: "send-show-reminders",

      triggers: {
        cron: "0 */8 * * *",
      },
    },

    async ({ step }) => {
      await step.run(
        "send-show-reminders",
        async () => {
          console.log(
            "Running show reminder function..."
          );

          const bookings =
            await Booking.find({
              isPaid: true,
            }).populate("show");

          console.log(
            `Found ${bookings.length} paid bookings`
          );

          for (const booking of bookings) {
            try {
              const user = await User.findById(
                booking.user
              );

              if (!user?.email) {
                continue;
              }

              const show = booking.show;

              if (!show) {
                continue;
              }

              const movieName =
                show?.movie?.title ||
                show?.title ||
                "Movie";

              const seats =
                booking.bookedSeats?.join(", ") ||
                "N/A";

              await sendEmail({
                to: user.email,

                subject:
                  "QuickShow - Movie Show Reminder",

                body: `
                  <div style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: auto;
                    padding: 20px;
                  ">

                    <h2>
                      Movie Show Reminder 🎬
                    </h2>

                    <p>
                      Hello ${user.name || "User"},
                    </p>

                    <p>
                      This is a reminder about your
                      upcoming movie booking.
                    </p>

                    <p>
                      <strong>Movie:</strong>
                      ${movieName}
                    </p>

                    <p>
                      <strong>Seats:</strong>
                      ${seats}
                    </p>

                    <p>
                      <strong>Booking ID:</strong>
                      ${booking._id}
                    </p>

                    <p>
                      Enjoy your movie with QuickShow!
                    </p>

                  </div>
                `,
              });

              console.log(
                `Reminder sent to ${user.email}`
              );
            } catch (error) {
              console.error(
                "Error sending reminder:",
                error.message
              );
            }
          }
        }
      );
    }
  );

// ======================================================
// 7. Send New Show Notifications
// ======================================================

const sendNewShowNotifications =
  inngest.createFunction(
    {
      id: "send-new-show-notifications",

      triggers: {
        event: "app/show.added",
      },
    },

    async ({ event, step }) => {
      const showId = event.data.showId;

      await step.run(
        "send-new-show-notifications",
        async () => {
          console.log(
            "New show notification started:",
            showId
          );

          const show =
            await Show.findById(showId);

          if (!show) {
            console.log(
              "Show not found:",
              showId
            );

            return;
          }

          const users = await User.find({
            email: { $exists: true, $ne: "" },
          });

          const movieName =
            show?.movie?.title ||
            show?.title ||
            "New Movie";

          for (const user of users) {
            try {
              await sendEmail({
                to: user.email,

                subject:
                  "QuickShow - New Movie Added 🎬",

                body: `
                  <div style="
                    font-family: Arial, sans-serif;
                    max-width: 600px;
                    margin: auto;
                    padding: 20px;
                  ">

                    <h2>
                      New Movie Added 🎬
                    </h2>

                    <p>
                      Hello ${user.name || "User"},
                    </p>

                    <p>
                      A new movie has been added
                      to QuickShow.
                    </p>

                    <h3>
                      ${movieName}
                    </h3>

                    <p>
                      Open QuickShow and book your
                      seats now!
                    </p>

                  </div>
                `,
              });

              console.log(
                `New show notification sent to ${user.email}`
              );
            } catch (error) {
              console.error(
                `Failed to send email to ${user.email}:`,
                error.message
              );
            }
          }
        }
      );
    }
  );

// ======================================================
// EXPORT ALL 7 FUNCTIONS
// ======================================================

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail,
  sendShowReminders,
  sendNewShowNotifications,
];