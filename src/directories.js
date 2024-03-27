import logger from "./logger.js";

import fs from "fs";

import path from "path";

/**
 *
 * @param savePath
 * @param fileNameWithoutExtension
 * @param extension
 */
export function processNewFiles(savePath, fileNameWithoutExtension, extension) {
  const oldFile = `${savePath}/${fileNameWithoutExtension}${extension}`;
  const newFile = `${savePath}/${fileNameWithoutExtension}-new${extension}`;

  fs.mkdirSync(`${savePath}/SyncBackups`, {
    recursive: true,
  });

  if (!fs.existsSync(newFile)) {
    throw new Error(`New file doesn't exist: ${newFile}`);
  }
  if (!fs.existsSync(oldFile)) {
    logger.info(`Old file doesn't exist, replacing with new file: ${oldFile}`);
    fs.renameSync(newFile, oldFile);
    return;
  }

  const oldFileSize = fs.statSync(oldFile).size;
  const newFileSize = fs.statSync(newFile).size;

  logger.info(`Old file size: ${oldFileSize}`);
  logger.info(`New file size: ${newFileSize}`);

  if (oldFileSize < newFileSize) {
    logger.info(
      `New file is bigger, replacing old file with new file: ${oldFile}`
    );
    fs.renameSync(newFile, oldFile);
    return;
  }
  if (oldFileSize > newFileSize) {
    logger.info(
      `New file is smaller, making a backup of the old file and replacing it with the new file: ${oldFile}`
    );
    fs.renameSync(
      oldFile,
      `${savePath}/SyncBackups/${fileNameWithoutExtension}-${getFileStringDate(
        new Date()
      )}${extension}`
    );
    fs.renameSync(newFile, oldFile);
    return;
  }
  if (oldFileSize === newFileSize) {
    logger.info(`New file is the same size, removve new file: ${newFile}`);

    // Delete newfile
    fs.unlinkSync(newFile);
  }
}

/**
 *
 * @param directories
 * @param localDirectory
 */
export async function checkLocalDirectories(directories, localDirectory) {
  if (!fs.existsSync(localDirectory)) {
    fs.mkdirSync(localDirectory, { recursive: true });
  }

  directories.forEach((directory) => {
    if (!fs.existsSync(`${localDirectory}${directory}`)) {
      fs.mkdirSync(`${localDirectory}${directory}`, { recursive: true });
    }
  });
}

/**
 * 
 * @param {number} number 
 * @param {number} targetLength 
 * @param {string} padString 
 * @returns 
 */
function padStart(number, targetLength, padString) {
  let string = number.toString();
  targetLength = Math.floor(targetLength) || 0;
  if (targetLength < string.length) return string;

  var pad = "";
  var len = targetLength - string.length;
  var i = 0;
  while (pad.length < len) {
    if (!padString[i]) {
      i = 0;
    }

    pad += padString[i];
    i++;
  }

  return pad + string;
}

/**
 *
 * @param {Date} date
 */
function getFileStringDate(date) {
  return `${date.getFullYear()}${padStart(date.getMonth()+1, 2, "0")}${padStart(
    date.getDate(),
    2,
    "0"
  )}${padStart(date.getHours(), 2, "0")}${padStart(
    date.getMinutes(),
    2,
    "0"
  )}${padStart(date.getSeconds(), 2, "0")}`;
}
