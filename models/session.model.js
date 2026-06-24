import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    createdAt: {
        type: Date,
        default : Date.now,
        expires : "7d"
    }

}, {
    strict: "throw"
})

const Session = mongoose.model("Session", sessionSchema);

export default Session;