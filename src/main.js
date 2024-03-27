#!/usr/bin/env node

import { program } from "commander";

program
  .name("IEEtec HMI file sync CLI tool")
  .description(
    `Software for syncing files from Siemens HMI to local directory. 
  
  It uses a configuration file to define the files to be synced and the directories to be monitored. 
  
  Files are downloaded from the HMI and saved to the local directory, if they don't exist. If the 
  file exists, if it is smaller than the one on the HMI, it is replaced, otherwise it is backed up 
  before downloading the new one. 
  
  Directories sync is done by checking the files on the HMI and downloading them if they don't exist 
  locally. Existing files are not replaced. Directories sync is only intended for static files, that 
  won't be modified on the HMI after creation, such as historical logs, reports, etc.`
  )
  .version("1.0")
  .requiredOption("-c, --config <file>", "Required. Configuration file path")
  .option("-d, --directory <directory>", "Directory for saving data", "./data")
  .parse(process.argv);

let options = program.opts();

if (!options.config) {
  console.error("Configuration file is required");
  process.exit(1);
}

import * as dotenv from "dotenv";
dotenv.config();

import * as fs from "fs";

import { WSApi } from "./winccWSConnection.js";
import logger from "./logger.js";
import { processNewFiles, checkLocalDirectories } from "./directories.js";

const HMI_IP = process.env.HMI_IP || "192.168.0.3";
const HMI_USER = process.env.HMI_USER || "admin";
const HMI_PASSWORD = process.env.HMI_PASSWORD || "1234";
const LOCAL_DIRECTORY = options.directory || "./data";

const HMI_LOGIN_PATH = "/FormLogin";


(async () => {
  const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

  const files = config.files;
  const directories = config.directories;

  checkLocalDirectories(directories, LOCAL_DIRECTORY);

  const maxLogFiles = 5;

  try {
    fs.unlinkSync(`${LOCAL_DIRECTORY}/run-${maxLogFiles}.log`);
  } catch (e) {
    logger.info("No log file to delete");
  }

  for (let i = maxLogFiles - 1; i >= 0; i--) {
    try {
      fs.renameSync(
        `${LOCAL_DIRECTORY}/run-${i}.log`,
        `${LOCAL_DIRECTORY}/run-${i + 1}.log`
      );
    } catch (e) {}
  }
  try {
    fs.renameSync(
      `${LOCAL_DIRECTORY}/last.log`,
      `${LOCAL_DIRECTORY}/run-0.log`
    );
  } catch (e) {}

  logger.info("Starting backup service...");
  logger.info(`HMI IP: ${HMI_IP}`);
  logger.info(`HMI User: ${HMI_USER}`);

  const hmiApi = new WSApi(
    HMI_IP,
    HMI_LOGIN_PATH,
    HMI_USER,
    HMI_PASSWORD,
    logger
  );

  await hmiApi.authenticate();

  // Get static named files
  for (const file of files) {
    await hmiApi.downloadAndSaveFile(
      `${LOCAL_DIRECTORY}${file.savePath}/${file.noExtensionName}-new${file.extension}`,
      file.filePath,
      5
    );
    processNewFiles(
      `${LOCAL_DIRECTORY}${file.savePath}`,
      file.noExtensionName,
      file.extension
    );
  }

  for (const directory of directories) {
    logger.info(`Processing directory: ${directory}`);
    const filesOnDevice = await hmiApi.getFilesInDeviceDirectory(
      `${directory}`
    );

    logger.info(`Files detected: ${filesOnDevice}`);

    for (const file of filesOnDevice) {
      logger.info(`Processing file: ${file.fileName}`);
      if (fs.existsSync(`${LOCAL_DIRECTORY}/${directory}/${file.fileName}`)) {
        logger.info(`File already exists: ${file.fileName}`);
        continue;
      }
      await hmiApi.downloadAndSaveFile(
        `${LOCAL_DIRECTORY}${directory}/${file.fileName}`,
        file.filePath,
        5
      );
    }
  }

  logger.info("Backup finished");
})();

/**
 *
 * @param number
 */
function twoDigits(number) {
  return number > 10 ? number.toString() : `0${number.toString()}`;
}

/**
 *
 * @param time
 */
export function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
