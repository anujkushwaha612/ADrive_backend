import redisClient from "../redis.js";

export default async function checkAuth(req, res, next) {
  const { sessionId } = req.signedCookies;
  if (!sessionId) {
    res.clearCookie("sessionId");
    return res.status(401).json({ error: "Not logged!" });
  }

  const session = await redisClient.json.get(`session:${sessionId}`);
  if (!session) {
    res.clearCookie("sessionId");
    return res.status(401).json({ error: "Not logged!" });
  }
  const user = { _id: session.userId, rootDirId: session.rootDirId };
  req.user = user;
  next();
}
