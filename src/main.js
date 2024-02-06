#!/usr/bin/env node

import * as dotenv from "dotenv";
dotenv.config();

import * as fs from "fs";

import { WSApi } from "./winccWSConnection.js";
import logger from "./logger.js";
import { processNewFiles, checkLocalDirectories } from "./directories.js";

const HMI_IP = process.env.HMI_IP || "192.168.0.3";
const HMI_USER = process.env.HMI_USER || "admin";
const HMI_PASSWORD = process.env.HMI_PASSWORD || "1234";
const HMI_BASE_PATH = process.env.HMI_BASE_PATH || "/StorageCardSD";
const LOCAL_DIRECTORY = process.env.LOCAL_DIRECTORY || "./data";

const HMI_LOGIN_PATH = "/FormLogin";


(async () => {

	const config = JSON.parse(
		fs.readFileSync("./config.json", "utf8")
	);

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
			fs.renameSync(`${LOCAL_DIRECTORY}/run-${i}.log`, `${LOCAL_DIRECTORY}/run-${i + 1}.log`);
		} catch (e) { }
	}
	try {
		fs.renameSync(`${LOCAL_DIRECTORY}/last.log`, `${LOCAL_DIRECTORY}/run-0.log`);
	} catch (e) { }

	logger.info("Starting backup service...");
	logger.info(`HMI IP: ${HMI_IP}`);
	logger.info(`HMI User: ${HMI_USER}`);

	const hmiApi = new WSApi(HMI_IP, HMI_LOGIN_PATH, HMI_USER, HMI_PASSWORD, logger);

	await hmiApi.authenticate();

	// Get static named files
	for (const file of files) {
		await hmiApi.downloadAndSaveFile(`${file.savePath}/${file.noExtensionName}-new${file.extension}`, file.filePath, 5);
		processNewFiles(file.savePath, file.noExtensionName, file.extension);
	}


	for (const directory of directories) {
		logger.info(`Processing directory: ${directory}`);
		const filesOnDevice = await hmiApi.getFilesInDeviceDirectory(`${HMI_BASE_PATH}${directory}`);

		for (const file of filesOnDevice) {
			logger.info(`Processing file: ${file.fileName}`);
			if (fs.existsSync(`${LOCAL_DIRECTORY}/${directory}/${file.fileName}`)) {
				logger.info(`File already exists: ${file.fileName}`);
				continue;
			}
			await hmiApi.downloadAndSaveFile(`${LOCAL_DIRECTORY}/${directory}/${file.fileName}`, file.filePath, file.fileName, 5);
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
	return new Promise(resolve => setTimeout(resolve, time));
}
