import express from "express";
import checkAuth from "../middlewares/auth.middleware.js";
import {
  loginUser,
  logoutAllDevices,
  registerUser,
  sendOtp,
} from "../controllers/user.controller.js";
import redisClient from "../redis.js";
import User from "../models/user.model.js";
import Directory from "../models/directory.model.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);
router.post("/send-otp", sendOtp);

router.get("/", checkAuth, async (req, res) => {
  const user = await User.findOne({ _id: req.user._id }).lean();
  if(!user){
    return res.status(404).json({
      message : "User not found"
    })
  }

  const usedSpace = await Directory.findById(req.user.rootDirId).lean().select("size");
  return res.status(200).json({
    name: user.name,
    email: user.email,
    picture : user.picture,
    maxStorage : user.maxStorage,
    storageUsed : usedSpace.size,
  });
});

router.post("/logout", checkAuth, async (req, res) => {
  const { sessionId } = req.signedCookies;
  await redisClient.del(`session:${sessionId}`);
  res.clearCookie("sessionId");
  return res.status(204).end();
});

router.post("/logout-all", checkAuth, logoutAllDevices);

export default router;
