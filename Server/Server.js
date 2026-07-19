import express from "express";
import cors from "cors";
import "dotenv/config";
import connectDB from "./configs/db.js";
import dns from "dns";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";

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

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions,
  })
);

// Start server only in local development
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

// Export app for Vercel
export default app;
export default app;