import { Webhook } from "svix";
import { inngest } from "../inngest/index.js";

const eventMap = {
  "user.created": "clerk/user.created",
  "user.updated": "clerk/user.updated",
  "user.deleted": "clerk/user.deleted",
};

export const clerkWebhooks = async (req, res) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({
      success: false,
      message: "CLERK_WEBHOOK_SECRET is not configured",
    });
  }

  const wh = new Webhook(webhookSecret);
  let evt;

  try {
    const payload =
      typeof req.body === "string"
        ? req.body
        : req.body?.toString?.("utf8") ?? req.body;

    evt = wh.verify(payload, {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    });
  } catch (error) {
    console.log("Clerk Webhook Signature Error:", error.message);
    return res.status(400).json({ success: false, message: error.message });
  }

  const eventName = eventMap[evt.type];

  if (!eventName) {
    return res.json({ received: true });
  }

  try {
    await inngest.send({ name: eventName, data: evt.data });
    return res.json({ received: true });
  } catch (error) {
    console.error("Clerk webhook processing error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
