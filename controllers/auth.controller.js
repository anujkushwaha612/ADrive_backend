import mongoose from "mongoose";
import User from "../models/user.model.js";
import { verifyIdToken } from "../services/googleAuth.js";
import Directory from "../models/directory.model.js";
import redisClient from "../redis.js";
import crypto from "crypto";

export const loginWithGoogle = async (req, res, next) => {
    const mongooseSession = await mongoose.startSession();
    try {
        const { idToken } = req.body;
        const userData = await verifyIdToken(idToken);
        const { name, email, picture, sub } = userData;

        const user = await User.findOne({ email });
        const sessionId = crypto.randomUUID();

        if (user) {
            const allSessions = await redisClient.ft.search(
                "userIdIdx",
                `@userId:{${user._id}}`,
                {
                    RETURN: [],
                }
            );

            if (allSessions.total >= 2) {
                await redisClient.del(allSessions.documents[0].id);
            }
            const redisKey = `session:${sessionId}`;
            await redisClient.json.set(redisKey, "$", {
                userId: user._id,
                rootDirId: user.rootDirId,
            });
            await redisClient.expire(redisKey, 60 * 60 * 24 * 7);
            await user.save();
            res.cookie("sessionId", sessionId, {
                httpOnly: true,
                signed: true,
                maxAge: 1000 * 60 * 60 * 24 * 7,
            });
            return res.status(200).json({
                success: true,
                message: "Logged in successfully",
            })
        }
        const userId = new mongoose.Types.ObjectId();
        const rootDirId = new mongoose.Types.ObjectId();

        //! Start Transaction
        mongooseSession.startTransaction();
        await Directory.insertOne(
            {
                _id: rootDirId,
                name: `root-${email}`,
                parentDirId: null,
                userId,
                path: [{ _id: rootDirId, name: `root-${email}` }],
            },
            { mongooseSession }
        );

        const newUser = await User.insertOne(
            {
                _id: userId,
                name,
                email,
                picture,
                rootDirId,
            },
            { mongooseSession }
        );

        mongooseSession.commitTransaction();

        const redisKey = `session:${sessionId}`;
        await redisClient.json.set(redisKey, "$", {
            userId: newUser._id,
            rootDirId: newUser.rootDirId,
        });
        await redisClient.expire(redisKey, 60 * 60 * 24 * 7);

        res.cookie("sessionId", sessionId, {
            httpOnly: true,
            signed: true,
            maxAge: 1000 * 60 * 60 * 24 * 7,
        });
        return res.status(201).json({
            success: true,
            message: "Account created and logged in successfully",
        });

    } catch (error) {
        mongooseSession.abortTransaction();
        next(error);
        // if (error.code === 11000 && error.keyPattern.email) {
        //     return res.status(409).json({
        //         error: "User already exist",
        //         message:
        //             "user with this email already exists. Please try registering with different email.",
        //     });
        // }
        // res.status(500).json({
        //     success: false,
        //     message: "Google login failed",
        //     error: error.message,
        // });
    }
};