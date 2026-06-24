import {getSignedUrl} from "@aws-sdk/cloudfront-signer"

const private_key = process.env.CLOUDFRONT_PRIVATE_KEY;
const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
const distributionDomain = process.env.CLOUDFRONT_DISTRIBUTION_DOMAIN;

export const getCloudFrontSignedUrl = (fileKey, expiryInSeconds = 300) => {
    const url = `https://${distributionDomain}/${fileKey}`;
    const signedUrl = getSignedUrl({
        url,
        privateKey: private_key,
        keyPairId,
        dateLessThan: new Date(Date.now() + expiryInSeconds * 1000).toISOString(),
    });
    return signedUrl;
}