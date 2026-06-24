import { Router } from "express"
import { deleteUser, forceLogoutUser, getAllUsers } from "../controllers/admin.controller.js";
import checkAuth from "../middlewares/auth.middleware.js";
import User from "../models/user.model.js";

const router = Router();

router.get("/users", checkAuth, async (req, res, next) => {
    const user = await User.findOne({ _id: req.user._id }, { role: 1, _id: 0 }).lean();
    req.user.role = user.role;
    if (user.role !== "user") {
        return next();
    }
    return res.status(403).json({
        message: "Unauthorized"
    })
}, getAllUsers);

router.post("/logout-user", checkAuth, async (req, res, next) => {
    const user = await User.findOne({ _id: req.user._id }, { role: 1, _id: 0 }).lean();
    req.user.role = user.role;
    if (user.role !== "user") {
        return next();
    }
    return res.status(403).json({
        message: "Unauthorized"
    })
}, forceLogoutUser);

router.delete("/delete/:userId", checkAuth, async (req, res, next) => {
    const user = await User.findOne({ _id: req.user._id }, { role: 1, _id: 0 }).lean();
    req.user.role = user.role;
    if (user.role === "admin") {
        return next();
    }
    return res.status(403).json({
        message: "Unauthorized"
    })
}, deleteUser);

export default router;
