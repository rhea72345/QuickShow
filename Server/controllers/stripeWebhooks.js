import Stripe from "stripe";
import Booking from "../models/Booking.js";
import { inngest } from "../inngest/index.js";

export const stripeWebhooks = async (request, response) => {
  console.log("Webhook Hit");

  const stripeInstance = new Stripe(
    process.env.STRIPE_SECRET_KEY
  );

  const sig = request.headers["stripe-signature"];

  let event;

  // ==========================================
  // Verify Stripe Webhook
  // ==========================================

  try {
    event = stripeInstance.webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.log(
      "Webhook Signature Error:",
      error.message
    );

    return response
      .status(400)
      .send(`Webhook Error: ${error.message}`);
  }

  // ==========================================
  // Process Stripe Event
  // ==========================================

  try {
    console.log("Event Type:", event.type);

    switch (event.type) {
      // ========================================
      // Payment Successful
      // ========================================

      case "checkout.session.completed": {
        const session = event.data.object;

        const { bookingId } = session.metadata || {};

        // ======================================
        // Booking ID check
        // ======================================

        if (!bookingId) {
          console.log(
            "Booking ID not found in metadata"
          );
          break;
        }

        // ======================================
        // Mark booking as paid
        // ======================================

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
          `Booking ${bookingId} marked as PAID`
        );

        // ======================================
        // 1. Send booking confirmation email
        // ======================================

        await inngest.send({
          name: "app/send-booking-confirmation-email",
          data: {
            bookingId: bookingId.toString(),
          },
        });

        console.log(
          `Booking confirmation email event sent for ${bookingId}`
        );

        // ======================================
        // 2. Send check payment event
        // ======================================
        // NOTE:
        // This event is handled by the
        // release-seats-delete-booking function.

        await inngest.send({
          name: "app/checkpayment",
          data: {
            bookingId: bookingId.toString(),
          },
        });
        
        // Send event to Inngest - Booking confirmation email
await inngest.send({
  name: "app/send-booking-confirmation-email",
  data: {
    bookingId: bookingId.toString(),
  },
});

        console.log(
          `Check payment event sent for booking ${bookingId}`
        );

        break;
      }

      // ========================================
      // Other Events
      // ========================================

      default:
        console.log(
          "Unhandled event type:",
          event.type
        );
    }

    // ==========================================
    // Response
    // ==========================================

    return response.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Webhook processing error:",
      error
    );

    return response
      .status(500)
      .send("Internal Server Error");
  }
};