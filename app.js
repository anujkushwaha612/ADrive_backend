import express from "express";
import cors from "cors";
import directoryRoutes from "./routes/directory.route.js";
import fileRoutes from "./routes/file.routes.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.route.js";
import adminRoutes from "./routes/admin.route.js";
import cookieParser from "cookie-parser";
import checkAuth from "./middlewares/auth.middleware.js";
import { connectDB } from "./config/db.js";
import shareRoutes from "./routes/share.route.js";

const mySecretKey = process.env.COOKIE_SECRET_KEY;
const PORT = process.env.PORT
await connectDB();

const app = express();
app.use(cookieParser(mySecretKey));
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

app.use("/directory", checkAuth, directoryRoutes);
app.use("/file", checkAuth, fileRoutes);
app.use("/user", userRoutes);
app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/share", shareRoutes);

app.use((err, req, res, next) => {
  res.status(err.status || 500).json({
    message: err.message || "error occurred",
  });
});

app.listen(PORT, () => {
  console.log(`Server Started`);
});


