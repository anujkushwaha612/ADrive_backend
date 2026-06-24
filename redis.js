import { createClient } from "redis";

const redisClient = createClient();

redisClient.on("error", (error) => {
  console.log("Redis Client Error", error);
  process.exit(1);
});

await redisClient.connect();

redisClient.getJSON = async function (key) {
  const data = await this.get(key);
  return JSON.parse(data);
};

redisClient.setJSON = async function (key, data) {
  return await this.set(key, JSON.stringify(data));
};

export default redisClient;
