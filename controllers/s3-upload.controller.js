import s3 from "../config/s3.config.js";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post"; 
import Directory from "../models/directory.model.js";
import File from "../models/file.model.js";
import path from "node:path";

const STORAGE_QUOTA = 100 * 1024 * 1024; // 100 MB in bytes


export const getS3SignedUrl = async (req, res, next) => {
    let createdFile = null;

    try {
        const user = req.user;
        const { filename, filesize, contentType } = req.body;

        if (!filename || filesize === undefined || !contentType) {
            return res.status(400).json({ error: "Missing required file metadata." });
        }

        const sizeInBytes = Number(filesize);
        if (isNaN(sizeInBytes) || sizeInBytes <= 0) {
            return res.status(400).json({ error: "Invalid file size." });
        }

        const parentDirId = req.params.parentDirId || user.rootDirId.toString();

        const [parentDir, rootDir] = await Promise.all([
            Directory.findOne({ _id: parentDirId, userId: user._id }).lean(),
            Directory.findById(user.rootDirId).lean()
        ]);

        if (!parentDir) {
            return res.status(404).json({ message: "Directory not found" });
        }

        if ((sizeInBytes + rootDir.size) > STORAGE_QUOTA) {
            return res.status(413).json({ error: "File too large! Quota exceeded" });
        }

        const extension = path.extname(filename);

        createdFile = await File.create({
            name: filename,
            size: sizeInBytes,
            extension,
            userId: user._id,
            parentDirId,
            uploadStatus: "uploading",
        });

        const s3Key = createdFile._id.toString() + extension;

        // Generate a POST policy instead of a PUT URL
        const { url, fields } = await createPresignedPost(s3, {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: s3Key,
            Conditions: [
                ["content-length-range", 0, sizeInBytes], // STRICT ENFORCEMENT: Max size is what they claimed
                ["eq", "$Content-Type", contentType]      // STRICT ENFORCEMENT: File type cannot change
            ],
            Fields: {
                "Content-Type": contentType,
            },
            Expires: 300, 
        });

        return res.status(200).json({
            message: "Upload approved",
            uploadUrl: url,
            uploadFields: fields, // Send the AWS required fields to the client
            fileId: createdFile._id,
        });
        
    } catch (error) {
        if (createdFile) {
            await File.findByIdAndDelete(createdFile._id);
        }
        console.error("Presigned URL Error:", error);
        next(error);
    }
};
