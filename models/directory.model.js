import { model, Schema } from "mongoose";

const directorySchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    size: {
        type: Number,
        required: true,
        default: 0,
    },
    parentDirId: {
        type: Schema.Types.ObjectId,
        ref: "Directory",
        default: null,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    path: [{
        _id: {
            type: Schema.Types.ObjectId,
            ref: "Directory",
        },
        name: {
            type: String,
            required: true,
        }
    }]
}, {
    strict: "throw",
    versionKey: false,
    timestamps: true,
})

const Directory = model("Directory", directorySchema);
export default Directory;