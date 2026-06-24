import { model, Schema } from "mongoose";

const fileSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    extension: {
        type: String,
        required: true,
    },
    parentDirId: {
        type: Schema.Types.ObjectId,
        ref: "Directory",
        required: true,
    },
    size: {
        type: Number,
        required: true,
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    uploadStatus : {
        type : String,
        enum : ["uploading", "completed", "failed"],
        default : "uploading"
    },
    sharedWith : [{
        _id : {
            type : Schema.Types.ObjectId,
            ref : "User"
        },
        role : {
            type : String,
            enum : ["viewer", "editor"],
            default : "viewer"
        }
    }]
}, {
    strict: "throw",
    versionKey: false,
    timestamps: true,
})

const File = model("File", fileSchema);
export default File;