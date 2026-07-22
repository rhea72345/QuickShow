import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";
import dns from "dns";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import showRouter from "./routes/showRoutes.js";
import bookingRouter from "./routes/bookingRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import userRouter from "./routes/userRoutes.js";

// Change DNS
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const port = process.env.PORT || 3000;

// Connect Database
await connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use(clerkMiddleware());

// Routes
app.get("/", (req, res) => {
  res.send("Server is Live!");
});

app.get("/test", (req, res) => {
  res.json({ success: true });
});

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions,
  })
);

// ✅ Correct
app.use("/api/show", showRouter);
app.use('/api/booking', bookingRouter)
app.use('/api/admin',adminRouter)
app.use('/api/user', userRouter)

// Start server only in local development
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

export default app;
