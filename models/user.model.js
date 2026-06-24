import { model, Schema } from "mongoose";

const UserSchema = new Schema({
    name: {
        type: String,
        required: true,
        min: [3, "Name must be at least 3 characters long"],
        max: [20, "Name must be at most 20 characters long"],
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function (v) {
                return /^[a-zA-Z0-9._%+-]+@gmail.com$/i.test(v);
            },
            message: props => `${props.value} is not a valid email address!`,
        },
    },
    password: {
        type: String,
        min: [6, "Password must be at least 6 characters long"],
    },
    role: {
        type: String,
        enum: ["user", "admin", "manager"],
        default: "user"
    },
    picture: {
        type: String,
        default: "https://img.freepik.com/free-vector/isolated-young-handsome-man-different-poses-white-background-illustration_632498-859.jpg?semt=ais_hybrid&w=740&q=80"
    },
    maxStorage: {
        type: Number,
        required: true,
        default: 1024 * 1024 * 1024 ,
    },
    rootDirId: {
        type: Schema.Types.ObjectId,
        ref: "Directory",
        required: true,
    },
}, {
    strict: "throw",
    versionKey: false
})

// UserSchema.pre("save", async function (next) {
//     if (!this.isModified("password")) {
//         return next();
//     }
//     this.password = await bcrypt.hash(this.password, 12);
//     next();
// })

// UserSchema.methods.comparePassword = async function (password) {
//     return await bcrypt.compare(password, this.password);
// }

const User = model("User", UserSchema);
export default User;