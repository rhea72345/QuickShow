import express from "express";
import { requireAuth } from "@clerk/express";
import { getFavorites, getUserBookings, updateFavorite } from "../controllers/userController.js";
import { ensureUserInDB } from "../middleware/ensureUser.js";

const userRouter = express.Router();

userRouter.get('/bookings', requireAuth(), ensureUserInDB, getUserBookings)
userRouter.post('/update-favorite', requireAuth(), ensureUserInDB, updateFavorite)
userRouter.get('/favorites', requireAuth(), ensureUserInDB, getFavorites)

export default userRouter;