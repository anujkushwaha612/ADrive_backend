import express from "express";
import validateIDMiddleware from "../middlewares/validateID.middleware.js";
import { createDirectory, deleteDirectory, getDirectoryById, renameDirectory } from "../controllers/directory.controller.js";

const router = express.Router();

router.param("parentDirId", validateIDMiddleware);
router.param("id", validateIDMiddleware);

router.get("/:id?", getDirectoryById);
router.post("/:parentDirId?", createDirectory);
router.patch("/:id", renameDirectory);
router.delete("/:id", deleteDirectory);


export default router;
