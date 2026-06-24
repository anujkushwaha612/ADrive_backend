import { ObjectId } from "mongodb";
export default function (req, res, next, id) {
  if (!ObjectId.isValid(id)) {
    return res.status(404).json({ message: "ID is not valid" });
  }
  next();
}
