import Directory from "../models/directory.model.js";
import File from "../models/file.model.js";
import { handleFolderSizeUpdate } from "../utils/folderSize.utils.js";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import s3 from "../config/s3.config.js";
import mongoose from "mongoose";

export const getDirectoryById = async (req, res, next) => {
  try {
    const user = req.user;
    const _id = req.params.id || user.rootDirId.toString();

    const directoryData = await Directory.findOne({
      _id,
      userId: user._id,
    }).lean();
    
    if (!directoryData) {
      return res.status(404).json({
        message: "Directory not found or you don't have access to this directory",
      });
    }

    // OPTIMIZATION: Run independent queries concurrently
    const [files, directories] = await Promise.all([
      File.find({ 
        parentDirId: directoryData._id,
        userId: user._id // Added for stricter security
      })
      .populate("userId", { picture: 1, email: 1, _id: 0 })
      .lean(),
      
      Directory.find({
        parentDirId: _id,
        userId: user._id,
      }).lean()
    ]);

    return res.status(200).json({
      ...directoryData,
      files: files.map((file) => ({ ...file, id: file._id })),
      directories: directories.map((dir) => ({ ...dir, id: dir._id })),
    });
  } catch (error) {
    console.error("Get Directory Error:", error);
    error.message = "Failed to get the directory";
    next(error);
  }
};

export const createDirectory = async (req, res, next) => {
  try {
    const user = req.user;
    const parentDirId = req.params.parentDirId || user.rootDirId.toString();
    
    // Clean the input to prevent empty-space folder names
    const dirname = req.body.dirname?.trim() || "New Folder";

    const parentDirData = await Directory.findOne({
      _id: parentDirId,
    }).lean();

    if (!parentDirData) {
      return res.status(404).json({
        message: "Parent directory does not exist",
      });
    }

    const parentPath = parentDirData.path || [];
    const fileId = new mongoose.Types.ObjectId();

    const newPath = [
      ...parentPath,
      {
        _id: fileId,
        name: dirname 
      }
    ];

    // FIX: Changed insertOne() to create() for Mongoose compatibility
    const newDir = await Directory.create({
      _id: fileId,
      name: dirname,
      parentDirId,
      userId: user._id,
      path: newPath, 
    });

    return res.status(201).json({
      message: "Directory created successfully",
      directory: newDir
    });

  } catch (error) {
    console.error("Create Directory Error:", error);
    next(error);
  }
};

export const renameDirectory = async (req, res, next) => {
  try {
    const user = req.user;
    const { id } = req.params;
    const newDirName = req.body.newDirName?.trim();

    if (!newDirName) {
        return res.status(400).json({ message: "Directory name cannot be empty" });
    }

    // OPTIMIZATION: Run both updates concurrently
    await Promise.all([
      // 1. Update the actual directory's root name
      Directory.updateOne(
        { _id: id, userId: user._id },
        { $set: { name: newDirName } }
      ),
      
      // 2. Update the name inside the path array for this directory AND all its descendants
      Directory.updateMany(
        { "path._id": id },
        { $set: { "path.$.name": newDirName } }
      )
    ]);

    res.status(200).json({ message: "Directory Renamed!" });
  } catch (error) {
    console.error("Rename Directory Error:", error);
    next(error);
  }
};


export const deleteDirectory = async (req, res, next) => {
    const session = await mongoose.startSession();

    try {
        const { id } = req.params;
        const user = req.user;

        // 1. Verify ownership of the root directory being deleted
        const directory = await Directory.findOne({ _id: id, userId: user._id }).lean();
        if (!directory) {
            return res.status(404).json({ message: "Directory not found" });
        }

        // 2. Gather all nested data
        const collections = { dirIds: [], fileIds: [], s3Keys: [] };
        await collectDescendants(id, user._id, collections);

        // 3. DELETE FROM S3 FIRST (Outside the transaction)
        // S3 allows deleting up to 1000 objects in a single batch request.
        if (collections.s3Keys.length > 0) {
            const chunkSize = 1000;
            for (let i = 0; i < collections.s3Keys.length; i += chunkSize) {
                const chunk = collections.s3Keys.slice(i, i + chunkSize);
                
                const command = new DeleteObjectsCommand({
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Delete: {
                        Objects: chunk, // Format must be: [{ Key: "id1.png" }, { Key: "id2.pdf" }]
                        Quiet: true     // Reduces AWS response payload size
                    }
                });
                await s3.send(command);
            }
        }

        // ==========================================
        // 4. START THE DATABASE TRANSACTION
        // ==========================================
        session.startTransaction();

        // Bulk delete all files in one query
        if (collections.fileIds.length > 0) {
            await File.deleteMany({ _id: { $in: collections.fileIds } }, { session });
        }

        // Bulk delete all directories in one query
        await Directory.deleteMany({ _id: { $in: collections.dirIds } }, { session });

        // Update the parent folder size
        await handleFolderSizeUpdate(directory.parentDirId, -directory.size, session);

        await session.commitTransaction();
        // ==========================================

        return res.status(200).json({
            message: "Directory and all nested contents deleted successfully",
        });

    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        console.error("Delete Directory Error:", error);
        error.status = 500;
        error.message = "Failed to delete the directory";
        next(error);
    } finally {
        session.endSession();
    }
};

/**
 * Helper Function: Recursively collects all IDs instead of deleting them one by one.
 */
const collectDescendants = async (directoryId, userId, collections) => {
    // Add current directory to the deletion list
    collections.dirIds.push(directoryId);

    // 1. Find and collect all files in this directory
    const files = await File.find(
        { parentDirId: directoryId, userId }, 
        { _id: 1, extension: 1 } // Only fetch what we need to save RAM
    ).lean();

    for (const file of files) {
        collections.fileIds.push(file._id);
        // Format the S3 key exactly how DeleteObjectsCommand expects it
        collections.s3Keys.push({ Key: file._id.toString() + file.extension });
    }

    // 2. Find all subdirectories and recursively dive into them
    const subDirectories = await Directory.find(
        { parentDirId: directoryId, userId }, 
        { _id: 1 }
    ).lean();

    for (const dir of subDirectories) {
        await collectDescendants(dir._id, userId, collections);
    }
};
