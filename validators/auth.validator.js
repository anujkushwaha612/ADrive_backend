import {z} from "zod/v4";

export const loginValidator = z.object({
    email : z.email("Invalid email address"),
    password : z.string().min(6, "Password must be at least 6 characters long").max(50, "Password must be at most 50 characters long"),
})

export const registerValidator = loginValidator.extend({
    name : z.string().min(3, "Name must be at least 3 characters long").max(50, "Name must be at most 50 characters long"),
    otp : z.string().length(6, "Enter a valid 6 digit OTP").regex(/^[0-9]+$/),
})
