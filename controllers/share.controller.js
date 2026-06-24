import File from "../models/file.model.js";
import User from "../models/user.model.js";
import { inviteValidator } from "../validators/invite.validator.js";
import { z } from "zod/v4";

export const inviteWithEmail = async (req, res, next) => {
    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "File ID is required",
            });
        }

        const { success, data, error } = inviteValidator.safeParse(req.body);

        if (!success) {
            const errors = z.flattenError(error).fieldErrors;
            return res.status(400).json({
                success: false,
                message:
                    Object.values(errors)[0]?.[0] || "Invitation validation failed",
            });
        }

        const { email, role } = data;

        const fileOwner = req.user._id;

        const inviteUser = await User.findOne({ email }).lean();

        if (!inviteUser) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // prevent owner inviting themselves
        if (inviteUser._id.toString() === fileOwner.toString()) {
            return res.status(400).json({
                success: false,
                message: "Owner cannot share file with themselves",
            });
        }

        const file = await File.findOneAndUpdate(
            {
                _id: fileId,
                userId: fileOwner,
            },
            {
                $addToSet: {
                    sharedWith: {
                        _id: inviteUser._id,
                        role: role.toLowerCase(), // must match enum: viewer / editor
                    },
                },
            },
            {
                new: true,
                runValidators: true,
            }
        );

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Invitation sent successfully",
        });
    } catch (error) {
        console.log(error);
        next(error);
    }
};

export const getSharedFilesWithMe = async (req, res, next) => {
    try {
        const files = await File.find(
            { "sharedWith._id": req.user._id },
            {
                name: 1,
                size: 1,
                "sharedWith.role": 1,   // <-- only matched object
                _id: 0
            }
        ).populate("userId", "name picture -_id").lean();

        // const result = files.map(f => ({
        //     name: f.name,
        //     size: f.size,
        //     role: f.sharedWith?.[0]?.role,
        //     user: f.userId
        // }));

        return res.status(200).json({
            success: true,
            message: "Shared files fetched successfully",
            sharedFilesWithMe: files,
        });
    } catch (error) {
        next(error);
    }
}

export const getFileSharedWith = async (req, res, next) => {
    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({
                success: false,
                message: "File ID is required",
            });
        }

        const file = await File.findOne({ _id: fileId }, {
            sharedWith: 1,
            _id: 0
        }).populate("sharedWith._id", "name picture email -_id").lean();

        if (!file) {
            return res.status(404).json({
                success: false,
                message: "File not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "File shared with fetched successfully",
            sharedWith: file.sharedWith,
        });
    } catch (error) {
        next(error);
    }
}

export const getFileSharedByMe = async (req, res, next) => {
    try {
        const files = await File.find({ userId: req.user._id, "sharedWith.0": { $exists: true } }, {
            extension: 0,
            createdAt: 0,
            updatedAt: 0,
            _id: 0,
            parentDirId: 0,
            userId: 0,
        })
            .populate("sharedWith._id", "name picture email -_id")
            .lean();

        if (!files) {
            return res.status(404).json({
                success: false,
                message: "Files not found",
            });
        }
        return res.status(200).json({
            success: true,
            message: "File shared by me fetched successfully",
            sharedByMe: files,
        });
    } catch (error) {
        next(error);
    }
}