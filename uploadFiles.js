const path = require("node:path");
const fs = require("node:fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const NOW = new Date().toISOString().split("Z")[0];
const BUCKET_NAME = "elmeteo";
const FILES_FOLDERS = [
  "/Users/gian/Documents/folder1",
  "/Users/gian/Documents/folder2",
  "/Users/gian/Desktop/folder3",
];

const s3Client = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const parseFilePath = (folderPath, files, path) => {
  const fullPath = `${folderPath}/${path}`;
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    const fileContent = fs.readFileSync(fullPath);
    return files.push({
      Key: path,
      Body: fileContent,
    });
  }
  const keys = fs.readdirSync(fullPath);
  return keys.map((key) => parseFilePath(folderPath, files, `${path}/${key}`));
};

const uploadFilesToBucket = async ({ folderPath, bucketName }) => {
  console.log(`\nUploading files from ${folderPath}...`);
  const files = [];
  const keys = fs.readdirSync(folderPath);
  keys
    .filter((key) => !key.startsWith(".gitignore"))
    .forEach((key) => parseFilePath(folderPath, files, key));

  const folderName = folderPath.split("/").pop();
  for (const file of files) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Body: file.Body,
        Key: `${NOW}/${folderName}/${file.Key}`,
      })
    );
    // console.log(`${file.Key} - uploaded.`);
  }
  console.log(`Uploaded ${files.length} files to ${bucketName}/${NOW}/${folderName}.`);
};

const main = async () => {
  try {
    for (const folderPath of FILES_FOLDERS) {
      await uploadFilesToBucket({
        bucketName: BUCKET_NAME,
        folderPath,
      });
      console.log(`✅ Upload ${folderPath} done!`);
    }
  } catch (err) {
    console.log("🚨 Error uploading files to bucket");
    console.error(err);
  }
};

main();
