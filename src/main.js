import * as dotenv from 'dotenv'
dotenv.config()

import fetch from 'node-fetch';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { parse as cookieParser } from 'cookie';
import { parse as htmlParser } from 'node-html-parser';
import * as fs from 'fs';

// eslint-disable-next-line no-undef
const HMI_IP = process.env.HMI_IP || '192.168.0.3';
// eslint-disable-next-line no-undef
const HMI_USER = process.env.HMI_USER || 'admin';
// eslint-disable-next-line no-undef
const HMI_PASSWORD = process.env.HMI_PASSWORD || '1234';

const HMI_LOGIN = '/FormLogin'; // 'LoginForm'

const HMI_BASE_FILES_PATH = '/StorageCardSD';

const files = [
	{
		remote: 'Logs/AlarmasGMP0.csv',
		local: 'AlarmasGMP0',
		extension: '.csv'
	},
	{
		remote: 'Logs/FicheroGMP0.csv',
		local: 'FicheroGMP0',
		extension: '.csv'
	},
	{
		remote: 'AuditTrail0.csv',
		local: 'AuditTrail0',
		extension: '.csv'
	}
];

const baseDir = 'data';

const directories = [
	'Logs_backup',
	'Informes'
];

(async () => {

	if (!existsSync(baseDir + '/SyncBackups')) {
		mkdirSync(baseDir + '/SyncBackups');
	}

	let session = await getWinccWSCookie(HMI_IP, HMI_USER, HMI_PASSWORD);

	// Get static named files
	for (const file of files) {
		console.log('Downloading file: ' + file.remote)
		await delay(100);
		for (let retries = 0; ; retries++) {
			try {
				console.log('Downloading file: ' + file.remote)
				await getWinccWSFile(file.local, HMI_IP, HMI_BASE_FILES_PATH + '/' + file.remote + '?UP=TRUE&FORCEBROWSE', baseDir + '/' + file.local + '-new' + file.extension, session);
				break;
			} catch (e) {
				console.log('Error downloading file: ' + file.remote);
				if (maxRetries < 6) {
					console.log('Retrying in 10 seconds...');
					await delay(10000);
					continue;
				} else {
					console.log('Max retries reached, aborting...');
					console.log(e);
					throw e;
				}
			}
		}
		console.log('File downloaded: ' + file.remote)
		// Check if files "baseDir + '/' + file.local + '-new' + file.csv" exists on data directory and then compare its size with baseDir + '/' + file.local + file.extension.
		// If the new file is bigger, then replace the old one with the new one.
		// If the new file is smaller, then make a backup of the old one and replace it with the new one.
		// If the new file is the same size, then remove the new file.
		// If the new file doesn't exist, then raise an error.
		// If the old file doesn't exist, then replace it with the new one.
		let oldFile = baseDir + '/' + file.local + file.extension;
		let newFile = baseDir + '/' + file.local + '-new' + file.extension;
		if (!fs.existsSync(newFile)) {
			throw new Error('New file doesn\'t exist: ' + newFile);
		}
		if (!fs.existsSync(oldFile)) {
			console.log('Old file doesn\'t exist, replacing with new file: ' + oldFile);
			fs.renameSync(newFile, oldFile);
			continue;
		}
		let oldFileSize = fs.statSync(oldFile).size;
		let newFileSize = fs.statSync(newFile).size;

		console.log('Old file size: ' + oldFileSize);
		console.log('New file size: ' + newFileSize);

		if (oldFileSize < newFileSize) {
			console.log('New file is bigger, replacing old file with new file: ' + oldFile);
			fs.renameSync(newFile, oldFile);
			continue;
		}
		if (oldFileSize > newFileSize) {
			console.log('New file is smaller, making a backup of the old file and replacing it with the new file: ' + oldFile);
			fs.renameSync(oldFile, baseDir + '/SyncBackups/' + file.local + '-syncbackup-' + new Date().getTime() + file.extension);
			fs.renameSync(newFile, oldFile);
			continue;
		}
		if (oldFileSize === newFileSize) {
			console.log('New file is the same size, removve new file: ' + newFile);
			// Delete newfile
			fs.unlinkSync(newFile);
		}

	}

	checkLocalDirectories(directories, baseDir);

	for (const directory of directories) {

		let filesOnDevice = await getFilesInDeviceDirectory(directory, session);

		// Check if files exists on data directory, if not download it
		for (const file of filesOnDevice) {
			console.log('Processing file: ' + file.fileName)
			await processFileDownload(baseDir, `http://${HMI_IP}`, directory, file, 5, session);
		}
	}


})();

async function processFileDownload(baseDir, hmiUrl, directory, file, maxRetries, session) {
	if (existsSync(baseDir + '/' + directory + '/' + file.fileName)) {
		console.log('File already exists: ' + file.fileName);
		return;
	}
	await delay(100);
	for (let retries = 0; ; retries++) {
		try {
			console.log('Downloading file: ' + file.fileName)
			await getWinccWSFile(file.fileName, HMI_IP, file.filePath, baseDir + '/' + directory + '/' + file.fileName, session);
			break;
		} catch (e) {
			console.log('Error downloading file: ' + file.fileName);
			if (maxRetries < 6) {
				console.log('Retrying in 10 seconds...');
				await delay(10000);
				continue;
			} else {
				console.log('Max retries reached, aborting...');
				console.log(e);
				throw e;
			}
		}
	}

}

async function checkLocalDirectories(directories, baseDir) {
	// Check if base directory exists
	if (!existsSync(baseDir)) {
		mkdirSync(baseDir);
	}

	// Create directories if don't exist
	directories.forEach((directory) => {
		if (!existsSync(baseDir + '/' + directory)) {
			mkdirSync(baseDir + '/' + directory);
		}
	});
}

async function getFilesInDeviceDirectory(directory, session) {

	let filesPageRequest = await getWinccWSPage(HMI_IP, '/StorageCardSD/' + directory + '?UP=TRUE&FORCEBROWSE', session);

	let filesPageHtml = htmlParser(await filesPageRequest.text());

	let filesTable = filesPageHtml.querySelectorAll('[href^="/StorageCardSD/"]');

	let filesOnDevice = [];

	filesTable.forEach((node) => {
		filesOnDevice.push({ fileName: node.text, filePath: node.getAttribute('href') });
	});

	return filesOnDevice;
}

async function getWinccWSPage(hmiIp, url, session) {
	return await fetch(`http://${hmiIp}/${url}`, {
		method: 'GET',
		headers: { 'Cookie': 'siemens_ad_session=' + session },
		timeout: 3000
	});
}

async function getWinccWSFile(fileName, hmiIp, getPath, savePath, session) {
	return new Promise((resolve, reject) => {
		try {
			console.log(`Requesting file ${fileName} from ${hmiIp}`);
			fetch(`http://${hmiIp}${getPath}`, {
				method: 'GET',
				headers: { 'Cookie': 'siemens_ad_session=' + session },
				timeout: 60000
			}).then((data) => {
				console.log(`Saving file ${fileName} to ${savePath}`);
				let file = createWriteStream(savePath);
				let stream = data.body.pipe(file);
				stream.on('finish', () => {
					resolve();
				});
			});
		}
		catch (error) {
			reject(error);
		}
	});
}

async function getWinccWSCookie(hmiIp, hmiUser, hmiPassword) {
	try {

		let loginRequest = await fetch(`http://${hmiIp}/FormLogin`, {
			method: 'POST',
			body: `Login=${hmiUser}&Password=${hmiPassword}`,
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		});
		let cookieValue = cookieParser(loginRequest.headers.get('set-cookie'));
		return cookieValue['siemens_ad_session'];
	} catch (e) {
		throw new Error('Can not login into HMI');
	}
}

function formatDate(date) {
	const map = {
		mm: date.getMonth(),
		dd: date.getDate(),
		yyyy: date.getFullYear()
	};
	if (map.mm < 10) map.mm = '0' + map.mm;
	if (map.dd < 10) map.dd = '0' + map.dd;
	return map.yyyy + '_' + map.mm + '_' + map.dd;
}

function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
}
