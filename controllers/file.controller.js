import File from "../models/file.model.js";
import { handleFolderSizeUpdate } from "../utils/folderSize.utils.js";
import { HeadObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../config/s3.config.js";
import mongoose from "mongoose";
import { getCloudFrontSignedUrl } from "../config/cloudfront.config.js";

export const getFileById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // 1. Verify the user has access to this file
        const fileData = await File.findOne({
            _id: id,
            userId: user._id,
        }).lean();

        if (!fileData) {
            return res.status(404).json({ message: "File not found" });
        }

        const s3Key = id + fileData.extension;

        const cloudFrontUrl = getCloudFrontSignedUrl(s3Key);

        // Return JSON with file metadata + signed URL for the overlay viewer
        return res.status(200).json({
            name: fileData.name,
            fileName: fileData.name,
            extension: fileData.extension,
            fileType: fileData.fileType || fileData.mimeType || "",
            mimeType: fileData.mimeType || fileData.fileType || "",
            size: fileData.size,
            cloudFrontUrl,
        });

    } catch (error) {
        console.error("Get File Error:", error);
        next(error);
    }
};

export const renameFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const { newFilename } = req.body;
        if (!newFilename) {
            return res.status(400).json({
                message: "valid filename is reqired",
            });
        }

        await File.updateOne(
            { _id: id, userId: user._id },
            { $set: { name: newFilename } }
        );
        return res.status(200).json({
            message: "File renamed successfully",
        });
    } catch (error) {
        error.status = 500;
        error.message = "Failed to rename the file";
        next(error);
    }
}

export const deleteFile = async (req, res, next) => {
    // 1. Initialize the session outside the try/catch so the 'finally' block can access it
    const session = await mongoose.startSession();

    try {
        const user = req.user;
        const _id = req.params.id;

        const file = await File.findOne({ _id, userId: user._id }, {
            extension: 1,
            parentDirId: 1,
            size: 1,
        }).lean();

        if (!file) {
            return res.status(404).json({ message: "File not found" });
        }

        // 2. DELETE FROM S3 FIRST
        // S3 operations cannot be rolled back in a Mongo transaction, 
        // so we do this first because it is idempotent (safe to retry).
        const s3Key = _id + file.extension;
        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: s3Key,
        });
        await s3.send(command);

        // ==========================================
        // 3. START THE TRANSACTION (All-or-Nothing)
        // ==========================================
        session.startTransaction();

        // Pass the session to the deleteOne query
        await File.deleteOne(
            { _id, userId: user._id },
            { session }
        );

        // Pass the session to your helper function
        await handleFolderSizeUpdate(file.parentDirId, -file.size, session);

        // If we reach this line, both DB operations succeeded. Lock it in!
        await session.commitTransaction();
        // ==========================================

        return res.status(200).json({
            message: "Successfully deleted the file",
        });

    } catch (error) {
        // If ANYTHING above fails, undo all database changes instantly
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error("Delete File Error:", error);
        error.status = 500;
        error.message = "Failed to delete the file";
        next(error);
        
    } finally {
        // ALWAYS end the session to prevent memory leaks, regardless of success or failure
        session.endSession();
    }
}

export const updateFile = async (req, res, next) => {
    // 1. Initialize session at the very top
    const session = await mongoose.startSession();

    try {
        const user = req.user;
        const fileId = req.params.id;

        const file = await File.findOne({
            _id: fileId,
            userId: user._id,
            uploadStatus: "uploading"
        });

        if (!file) {
            return res.status(404).json({
                message: "File not found or already processed",
            });
        }

        // 2. CHECK AWS S3 (Outside the transaction)
        let s3ContentLength;
        try {
            const command = new HeadObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: fileId + file.extension,
            });
            const response = await s3.send(command);
            s3ContentLength = response.ContentLength;
        } catch (s3Error) {
            console.log(s3Error);
            if (s3Error.name === "NotFound" || s3Error.$metadata?.httpStatusCode === 404) {
                return res.status(404).json({
                    message: "File not found in S3 bucket. Upload may have failed.",
                });
            }
            throw s3Error;
        }

        // 3. HANDLE MISMATCH (Cleanup)
        if (file.size !== s3ContentLength) {
            await s3.send(new DeleteObjectCommand({
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: fileId + file.extension,
            }));
            
            // This is a single DB operation, so it doesn't strictly need the transaction, 
            // but it cleans up the placeholder record safely.
            await File.findByIdAndDelete(fileId);

            return res.status(400).json({
                message: "File size does not match expected size. Upload cancelled.",
            });
        }

        // ==========================================
        // 4. START THE TRANSACTION (All-or-Nothing)
        // ==========================================
        session.startTransaction();

        // Pass the session to the folder size updater
        await handleFolderSizeUpdate(file.parentDirId, file.size, session);
        
        // Pass the session to the document save method
        file.uploadStatus = "completed";
        await file.save({ session });

        // Commit the changes if both succeeded!
        await session.commitTransaction();
        // ==========================================

        return res.status(200).json({
            message: "File updated successfully",
        });

    } catch (error) {
        // 5. ABORT IF ANYTHING FAILS
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error("Update File Error:", error);
        error.status = 500;
        error.message = "Failed to update the file";
        next(error);
        
    } finally {
        // 6. ALWAYS CLEAN UP THE SESSION
        session.endSession();
    }
}