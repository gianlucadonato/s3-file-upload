const path = require("node:path");
const fs = require("node:fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { Client } = require("basic-ftp");
const { formatDistance } = require("date-fns");

const NOW = new Date().toISOString().split("Z")[0];
const BUCKET_NAME = "elmeteo";
const FILES_FOLDERS = [
  { localPath: "/Users/gian/Documents/folder1", remotePath: "folder1" },
  { localPath: "/Users/gian/Documents/folder2", remotePath: "folder2" },
  { localPath: "/Users/gian/Desktop/folder3", remotePath: "folder3" },
];

const s3Client = new S3Client({
  region: "eu-central-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ftpClient = new Client();
ftpClient.ftp.verbose = true;

const logs = {
  destFolder: NOW,
  amazonS3: {
    startTime: null,
    endTime: null,
    error: null,
  },
  ftp: {
    startTime: null,
    endTime: null,
    error: null,
  },
  totalFiles: 0,
  totalUploadedFiles: 0,
  totalBytes: 0,
  totalUploadedMegaBytes: 0,
  startTime: new Date().toISOString(),
  endTime: null,
  error: null,
};

const parseFilePath = (folderPath, files, path) => {
  const fullPath = `${folderPath}/${path}`;
  const stat = fs.statSync(fullPath);
  if (stat.isFile()) {
    logs.totalBytes += stat.size 
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
    logs.totalFiles++;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Body: file.Body,
        Key: `${NOW}/${folderName}/${file.Key}`,
      })
    );
    logs.totalUploadedFiles++;
    // console.log(`${file.Key} - uploaded.`);
  }
  console.log(`Uploaded ${files.length} files to ${bucketName}/${NOW}/${folderName}.`);
};

const uploadFilesToAmazonS3 = async () => {
  console.log("🚀 Uploading files to Amazon S3...");
  logs.amazonS3.startTime = new Date().toISOString();
  try {
    for (const folderPath of FILES_FOLDERS) {
      await uploadFilesToBucket({
        bucketName: BUCKET_NAME,
        folderPath: folderPath.localPath,
      });
      console.log(`✅ Upload ${folderPath.localPath} done!`);
    }
  } catch (err) {
    console.log("Amazon S3 Error:", err);
    logs.error = true;
    logs.amazonS3.error = JSON.stringify(err, null, 2);
  } finally {
    logs.amazonS3.endTime = new Date().toISOString();
    s3Client.destroy();
  }
};

const uploadFilesToFtp = async () => {
  console.log("🚀 Uploading files via FTP...");
  logs.ftp.startTime = new Date().toISOString();
  try {
    await ftpClient.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: true,
    });
    for (const folderPath of FILES_FOLDERS) {
      await ftpClient.uploadFromDir(folderPath.localPath, folderPath.remotePath);
      console.log(`✅ Upload ${folderPath.localPath} done!`);
    }
  } catch (err) {
    console.error("FTP Error:", err);
    logs.error = true;
    logs.ftp.error = JSON.stringify(err, null, 2);
  } finally {
    logs.ftp.endTime = new Date().toISOString();
    ftpClient.close();
  }
};

function formatLogs() {
  logs.endTime = new Date().toISOString();
  logs.totalUploadedMegaBytes = (logs.totalBytes / (1024*1024)).toFixed(2) + " MB";
  if (logs.amazonS3.startTime && logs.amazonS3.endTime) {
    logs.amazonS3.duration = formatDistance(new Date(logs.amazonS3.startTime), new Date(logs.amazonS3.endTime));
  }
  if (logs.ftp.startTime && logs.ftp.endTime) {
    logs.ftp.duration = formatDistance(new Date(logs.ftp.startTime), new Date(logs.ftp.endTime));
  }
  if (logs.startTime && logs.endTime) {
    logs.duration = formatDistance(new Date(logs.startTime), new Date(logs.endTime));
  }
}

const main = async () => {
  await uploadFilesToAmazonS3();
  await uploadFilesToFtp();
  formatLogs();
  console.log('\n🐞 > logs:', JSON.stringify(logs, null, 2));
};

main();
