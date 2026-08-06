import Stripe from "stripe";
import Booking from "../models/Booking.js";

export const stripeWebhooks = async (request, response) => {
  console.log("Webhook Hit");

  const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = request.headers["stripe-signature"];

  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.log("Webhook Signature Error:", error.message);
    return response.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    console.log("Event Type:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        const { bookingId } = session.metadata || {};

        if (!bookingId) {
          console.log("Booking ID not found in metadata");
          break;
        }

        await Booking.findByIdAndUpdate(bookingId, {
          isPaid: true,
          $unset: { paymentLink: "" },
        });

        console.log(`Booking ${bookingId} marked as PAID`);

        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return response.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return response.status(500).send("Internal Server Error");
  }
};