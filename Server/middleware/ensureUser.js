import { clerkClient, getAuth } from "@clerk/express";
import User from "../models/User.js";

const buildUserFromClerk = (clerkUser) => {
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId
  );

  return {
    _id: clerkUser.id,
    name:
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      "User",
    email:
      primaryEmail?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "",
    image: clerkUser.imageUrl ?? "",
  };
};

export const ensureUserInDB = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return next();
    }

    const clerkUser = await clerkClient.users.getUser(userId);
    const userData = buildUserFromClerk(clerkUser);

    await User.findByIdAndUpdate(userId, userData, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });

    next();
  } catch (error) {
    console.error("ensureUserInDB error:", error.message);
    next();
  }
};
