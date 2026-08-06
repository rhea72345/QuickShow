import { Inngest } from "inngest";
import User from "../models/User.js";

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
    const { id } = event.data;

    await step.run("delete-user", async () => {
      await User.findByIdAndDelete(id);
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
      await User.findByIdAndUpdate(event.data.id, userData, {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      });
    });
  }
);

export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdation];
