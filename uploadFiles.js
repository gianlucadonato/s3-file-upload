const path = require("node:path");
const fs = require("node:fs");
const {
  S3Client,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const BUCKET_NAME = 'elmeteo';
const FILES_FOLDER = path.join(__dirname, './files');

const s3Client = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: "AWS_ACCESS_KEY_ID",
    secretAccessKey: "AWS_SECRET_ACCESS_KEY",
  },
});

const parseFilePath = (files, path) => {
  const fullPath = `${FILES_FOLDER}/${path}`;
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    const fileContent = fs.readFileSync(fullPath);
    return files.push({
      Key: path,
      Body: fileContent,
    });
  }
  const keys = fs.readdirSync(fullPath);
  return keys.map((key) => parseFilePath(files, `${path}/${key}`));
}

const uploadFilesToBucket = async ({ folderPath, bucketName }) => {
  console.log(`Uploading files from ${folderPath}\n`);
  const files = [];
  const keys = fs.readdirSync(folderPath);
  keys.forEach((key) => parseFilePath(files, key));
  
  const now = new Date().toISOString().split("Z")[0];
  for (const file of files) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Body: file.Body,
        Key: `${now}/${file.Key}`,
      }),
    );
    console.log(`${file.Key} uploaded successfully.`);
  }
};

const main = async () => {
  try {
    await uploadFilesToBucket({ bucketName: BUCKET_NAME, folderPath: FILES_FOLDER });
  } catch (err) {
    console.error(err);
  }
};

main();
