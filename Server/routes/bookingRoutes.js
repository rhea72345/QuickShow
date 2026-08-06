import express from 'express';
import { requireAuth } from '@clerk/express';
import { createBooking, getOccupiedSeats } from '../controllers/bookingController.js';
import { ensureUserInDB } from '../middleware/ensureUser.js';

const bookingRouter = express.Router();

bookingRouter.post('/create', requireAuth(), ensureUserInDB, createBooking);
bookingRouter.get('/seats/:showId', getOccupiedSeats);

export default bookingRouter;