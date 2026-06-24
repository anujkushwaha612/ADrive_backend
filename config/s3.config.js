import { S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({
    profile: "storageApp",
    region: "ap-south-1"
});

export default s3;