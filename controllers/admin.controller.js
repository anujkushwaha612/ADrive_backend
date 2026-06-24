import mongoose from "mongoose"
import Directory from "../models/directory.model.js"
import File from "../models/file.model.js"
import User from "../models/user.model.js"
import redisClient from "../redis.js"
import { DeleteObjectsCommand } from "@aws-sdk/client-s3"
import s3  from "../config/s3.config.js";

export const getAllUsers = async (req, res, next) => {
    try {
        const users = await User.find({}, {
            name: 1,
            email: 1,
            _id: 1,
            role: 1
        }).lean();

        const redisResult = await redisClient.ft.search("userIdIdx", "*", {
            RETURN: ["userId"],
            LIMIT: { from: 0, size: 10000 }
        })
        const onlineUserIds = new Set();
        redisResult.documents.forEach(doc => {
            onlineUserIds.add(doc.value.userId)
        })
        const usersWithStatus = users.map(user => {
            return {
                ...user,
                isLoggedIn: onlineUserIds.has(user._id.toString())
            }
        })
        return res.status(200).json({ usersWithStatus, role: req.user.role, currentUserId: req.user._id })
    } catch (error) {
        next(error)
    }
}

export const forceLogoutUser = async (req, res, next) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: "User id is required" })
        }

        const sessions = await redisClient.ft.search("userIdIdx", `@userId:{${userId}}`, {
            RETURN: []
        })
        if (sessions.total > 0) {
            const sessionIds = sessions.documents.map(doc => doc.id)
            await redisClient.del(sessionIds)
        }
        return res.status(200).json({
            message: `Successfully logged out. Terminated ${sessions.total} sessions.`
        });
    } catch (error) {
        next(error)
    }
}

export const deleteUser = async (req, res, next) => {
    const { userId } = req.params;
    
    if (!userId) {
        return res.status(400).json({ error: "User id is required" })
    }

    try {
        // 1. Fetch user first to prevent crashes if user doesn't exist
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({ error: "User not found!" });
        }
        if (user.role === "admin") {
            return res.status(403).json({ error: "You cannot delete an admin" })
        }

        // 2. Terminate all active Redis sessions
        const sessions = await redisClient.ft.search("userIdIdx", `@userId:{${userId}}`, {
            RETURN: []
        })
        if (sessions.total > 0) {
            const sessionIds = sessions.documents.map(doc => doc.id)
            await redisClient.del(sessionIds)
        }

        // 3. Gather all user files
        const files = await File.find({ userId }, { _id: 1, extension: 1 }).lean();
        
        const s3Keys = files.map(file => ({
            Key: file._id.toString() + file.extension
        }));

        // 4. DELETE FROM S3 FIRST (Batch Deletion)
        if (s3Keys.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < s3Keys.length; i += chunkSize) {
                const chunk = s3Keys.slice(i, i + chunkSize);
                
                const command = new DeleteObjectsCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Delete: {
                        Objects: chunk,
                        Quiet: true
                    }
                });
                await s3.send(command);
            }
        }

        // 5. DATABASE TRANSACTION
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            await Directory.deleteMany({ userId }, { session });
            await File.deleteMany({ userId }, { session });
            await user.deleteOne({ session });

            await session.commitTransaction();
        } catch (dbError) {
            await session.abortTransaction();
            throw dbError;
        } finally {
            session.endSession();
        }

        return res.status(200).json({
            message: "User and all associated assets deleted successfully.",
        });

    } catch (error) {
        console.error("Delete User Error:", error);
        return res.status(500).json({ error: "Failed to delete user" });
    }
};