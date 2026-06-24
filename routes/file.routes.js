import express from "express";
import validateIDMiddleware from "../middlewares/validateID.middleware.js";
import { deleteFile, getFileById, renameFile, updateFile } from "../controllers/file.controller.js";
import { getS3SignedUrl } from "../controllers/s3-upload.controller.js";
import checkAuth from "../middlewares/auth.middleware.js";
const router = express.Router();

router.param("parentDirId", validateIDMiddleware);
router.param("id", validateIDMiddleware);

router.get("/:id", checkAuth, getFileById);
router.post("/init-upload/:parentDirId?", checkAuth, getS3SignedUrl);
router.patch("/rename/:id", checkAuth, renameFile);
router.patch("/status/:id", checkAuth, updateFile);
router.delete("/:id", checkAuth, deleteFile);

export default router;
