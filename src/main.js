import * as dotenv from 'dotenv';
dotenv.config()

import * as winston from 'winston'

import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { parse as htmlParser } from 'node-html-parser';
import * as fs from 'fs';

import { WSApi } from './winccWSConnection.js';
import logger from './logger.js';

const HMI_IP = process.env.HMI_IP || '192.168.0.3';
const HMI_USER = process.env.HMI_USER || 'admin';
const HMI_PASSWORD = process.env.HMI_PASSWORD || '1234';

const HMI_LOGIN_PATH = '/FormLogin';
const HMI_BASE_PATH = '/StorageCardSD';

const LOCAL_DIRECTORY = process.env.LOCAL_DIRECTORY || './data';



const files = [
	{
		fileName: 'AlarmasGMP0.csv',
		noExtensionName: 'AlarmasGMP0',
		savePath: `${LOCAL_DIRECTORY}`,
		extension: '.csv',
		filePath: `${HMI_BASE_PATH}/Logs/AlarmasGMP0.csv?UP=TRUE&FORCEBROWSE`
	},
	{
		fileName: 'FicheroGMP0.csv',
		noExtensionName: 'FicheroGMP0',
		savePath: `${LOCAL_DIRECTORY}`,
		extension: '.csv',
		filePath: `${HMI_BASE_PATH}/Logs/FicheroGMP0.csv?UP=TRUE&FORCEBROWSE`
	},
	{
		fileName: 'AuditTrail0.csv',
		noExtensionName: 'AuditTrail0',
		savePath: `${LOCAL_DIRECTORY}`,
		extension: '.csv',
		filePath: `${HMI_BASE_PATH}/Logs/AuditTrail0.csv?UP=TRUE&FORCEBROWSE`
	}
];

const directories = [
	'Logs_backup',
	'Informes'
];

checkLocalDirectories(directories, LOCAL_DIRECTORY);

const maxLogFiles = 5;

try {
	fs.unlinkSync(LOCAL_DIRECTORY + '/run-' + maxLogFiles + '.log');
} catch (e) { }

for (let i = maxLogFiles - 1; i >= 0; i--) {
	try {
		fs.renameSync(LOCAL_DIRECTORY + '/run-' + i + '.log', LOCAL_DIRECTORY + '/run-' + (i + 1) + '.log');
	} catch (e) { }
}
try {
	fs.renameSync(LOCAL_DIRECTORY + '/last.log', LOCAL_DIRECTORY + '/run-0.log');
} catch (e) { }


logger.info('Starting backup service...');
logger.info('HMI IP: ' + HMI_IP);
logger.info('HMI User: ' + HMI_USER);

(async () => {

	let hmiApi = new WSApi(HMI_IP, HMI_LOGIN_PATH, HMI_USER, HMI_PASSWORD, logger);

	await hmiApi.authenticate();

	// Get static named files
	for (const file of files) {
		await hmiApi.downloadAndSaveFile(`${file.savePath}/${file.noExtensionName}-new${file.extension}`, file.filePath, 5);
		processNewFiles(file.savePath, file.noExtensionName, file.extension);
	}


	for (const directory of directories) {
		logger.info('Processing directory: ' + directory)
		let filesOnDevice = await hmiApi.getFilesInDeviceDirectory('/StorageCardSD/' + directory);
		for (const file of filesOnDevice) {
			logger.info('Processing file: ' + file.fileName)
			if (existsSync(file.savePath)) {
				logger.info('File already exists: ' + file.fileName);
				continue;
			}
			await hmiApi.downloadAndSaveFile(`${LOCAL_DIRECTORY}/${directory}/${file.fileName}`, file.filePath, file.fileName, 5);
		}
	}

	logger.info('Backup finished');

})();

function processNewFiles(savePath, fileNameWithoutExtension, extension) {
	let oldFile = savePath + '/' + fileNameWithoutExtension + extension;
	let newFile = savePath + '/' + fileNameWithoutExtension + '-new' + extension;
	if (!fs.existsSync(newFile)) {
		throw new Error('New file doesn\'t exist: ' + newFile);
	}
	if (!fs.existsSync(oldFile)) {
		logger.info('Old file doesn\'t exist, replacing with new file: ' + oldFile);
		fs.renameSync(newFile, oldFile);
		return;
	}

	let oldFileSize = fs.statSync(oldFile).size;
	let newFileSize = fs.statSync(newFile).size;

	logger.info('Old file size: ' + oldFileSize);
	logger.info('New file size: ' + newFileSize);

	if (oldFileSize < newFileSize) {
		logger.info('New file is bigger, replacing old file with new file: ' + oldFile);
		fs.renameSync(newFile, oldFile);
		return;
	}
	if (oldFileSize > newFileSize) {
		logger.info('New file is smaller, making a backup of the old file and replacing it with the new file: ' + oldFile);
		fs.renameSync(oldFile, savePath + '/SyncBackups/' + fileNameWithoutExtension + '-syncbackup-' + getFileStringDate(new Date()) + extension);
		fs.renameSync(newFile, oldFile);
		return;
	}
	if (oldFileSize === newFileSize) {
		logger.info('New file is the same size, removve new file: ' + newFile);
		// Delete newfile
		fs.unlinkSync(newFile);
	}
}



async function checkLocalDirectories(directories, localDirectory) {

	if (!existsSync(localDirectory)) {
		mkdirSync(localDirectory);
	}

	directories.forEach((directory) => {
		if (!existsSync(localDirectory + '/' + directory)) {
			mkdirSync(localDirectory + '/' + directory);
		}
	});

	if (!existsSync(localDirectory + '/SyncBackups')) {
		mkdirSync(localDirectory + '/SyncBackups');
	}

}

function getFileStringDate(date) {
	const map = {
		mm: date.getMonth(),
		dd: date.getDate(),
		yyyy: date.getFullYear(),
		hh: date.getHours(),
		min: date.getMinutes(),
		ss: date.getSeconds()
	};

	return `${map.yyyy}_${twoDigits(map.mm)}_${twoDigits(map.dd)}_${twoDigits(map.hh)}_${twoDigits(map.min)}_${twoDigits(map.ss)}`;
}

function twoDigits(number) {
	return number > 10 ? number.toString() : '0' + number.toString();
}

export function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}
