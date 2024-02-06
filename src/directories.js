
/**
 *
 * @param savePath
 * @param fileNameWithoutExtension
 * @param extension
 */
export function processNewFiles(savePath, fileNameWithoutExtension, extension) {
	const oldFile = `${savePath}/${fileNameWithoutExtension}${extension}`;
	const newFile = `${savePath}/${fileNameWithoutExtension}-new${extension}`;

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
		logger.info(`New file is bigger, replacing old file with new file: ${oldFile}`);
		fs.renameSync(newFile, oldFile);
		return;
	}
	if (oldFileSize > newFileSize) {
		logger.info(`New file is smaller, making a backup of the old file and replacing it with the new file: ${oldFile}`);
		fs.renameSync(oldFile, `${savePath}/SyncBackups/${fileNameWithoutExtension}-syncbackup-${getFileStringDate(new Date())}${extension}`);
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
		fs.mkdirSync(localDirectory);
	}

	directories.forEach(directory => {
		if (!fs.existsSync(`${localDirectory}/${directory}`)) {
			fs.mkdirSync(`${localDirectory}/${directory}`);
		}
	});

	if (!fs.existsSync(`${localDirectory}/SyncBackups`)) {
		fs.mkdirSync(`${localDirectory}/SyncBackups`);
	}

}

/**
 *
 * @param date
 */
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