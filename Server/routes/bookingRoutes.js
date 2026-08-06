import express from 'express';
import { requireAuth } from '@clerk/express';
import { createBooking, getOccupiedSeats, verifyPayment } from '../controllers/bookingController.js';
import { ensureUserInDB } from '../middleware/ensureUser.js';

const bookingRouter = express.Router();

bookingRouter.post('/create', requireAuth(), ensureUserInDB, createBooking);
bookingRouter.post('/verify-payment', requireAuth(), ensureUserInDB, verifyPayment);
bookingRouter.get('/seats/:showId', getOccupiedSeats);

export default bookingRouter;