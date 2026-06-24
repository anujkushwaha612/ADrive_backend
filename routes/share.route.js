import {Router} from "express";
import { getFileSharedByMe, getFileSharedWith, getSharedFilesWithMe, inviteWithEmail } from "../controllers/share.controller.js";
import validateIDMiddleware from "../middlewares/validateID.middleware.js";
import checkAuth from "../middlewares/auth.middleware.js";

const router = Router();

router.param("fileId", validateIDMiddleware);
router.post("/email/:fileId",checkAuth , inviteWithEmail);
router.get("/shared-with-me",checkAuth , getSharedFilesWithMe);
router.get("/shared-with/:fileId",checkAuth , getFileSharedWith);
router.get("/shared-by-me",checkAuth , getFileSharedByMe);

export default router;
