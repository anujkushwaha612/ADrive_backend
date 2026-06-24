import {z} from "zod/v4";

export const inviteValidator = z.object({
    email : z.email(),
    role : z.enum(["Viewer", "Editor"]),
})