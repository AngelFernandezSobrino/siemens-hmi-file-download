const schedule = require('node-schedule');
const express = require('express');
const fetch = require('node-fetch');
const Client = require('ftp');
const fs = require('fs');
const cookie = require('cookie');

// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 8080;

// eslint-disable-next-line no-undef
const HMI_IP = process.env.HMI_IP || 'http://172.16.7.204';
// eslint-disable-next-line no-undef
const FTP_SERVER_DIRECTION = process.env.FTP_SERVER_DIRECTION || 'ftp';
// eslint-disable-next-line no-undef
const FTP_SERVER_PORT = process.env.FTP_SERVER_PORT || 21;
// eslint-disable-next-line no-undef
const FTP_SERVER_USER = process.env.FTP_SERVER_USER || 'hmi';
// eslint-disable-next-line no-undef
const FTP_SERVER_PASSWORD = process.env.FTP_SERVER_PASSWORD || 'asdf123456789';

// eslint-disable-next-line no-undef
const NOMBRE_ARCHIVO_DATOS = process.env.NOMBRE_ARCHIVO_DATOS || 'datos.csv';
// eslint-disable-next-line no-undef
const NOMBRE_ARCHIVO_ALARMAS = process.env.NOMBRE_ARCHIVO_ALARMAS || 'alarmas.csv';

//const HMI_LOGIN = 'reqres.in/api/users'; // 'LoginForm'
const HMI_LOGIN = '/FormLogin'; // 'LoginForm'
const HMI_DOWNLOAD_DATA = '/StorageCardSD/Logs/Datos0.csv?UP=TRUE&FORCEBROWSE'; // '/StorageCardSD/Logs/Datos0.csv?UP=TRUE&FORCEBROWSE'
const HMI_DOWNLOAD_ALARMS = '/StorageCardSD/Logs/Alarmas0.csv?UP=TRUE&FORCEBROWSE'; // '/StorageCardSD/Logs/Alarmas0.csv?UP=TRUE&FORCEBROWSE'

var app = express();

// eslint-disable-next-line no-unused-vars
const weekDataSaving = schedule.scheduleJob('0 23 * * 0', function () {
	ftpRecordDatos();
	ftpRecordAlarmas();
});

// eslint-disable-next-line no-unused-vars
const actualDataSaving = schedule.scheduleJob('0 * * * *', function () {
	ftpUpdateDatos();
	ftpUpdateAlarmas();
});

app.use(express.static('public'));


app.get('/descargaAlarmas', (req, res) => {
	alarmasDownload(res);
});
app.get('/descargaDatos', (req, res) => {
	datosDownload(res);
});

app.listen(PORT, () => {
	console.info(`Server listening at port: ${PORT}`);
});

async function alarmasDownload(res) {
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) {
		res.status(500).send();
		return console.error('Impossible to login into HMI');
	}
	try {
		fetch(HMI_IP + HMI_DOWNLOAD_ALARMS, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
			timeout: 60000
		}).then((datos) => {
			let file = fs.createWriteStream('./public/Alarmas.csv');
			let stream = datos.body.pipe(file);
			stream.on('finish', () => {
				res.status(200).send();
			});
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).send();
	}
}

async function datosDownload(res) {
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) {
		res.status(500).send();
		return console.error('Impossible to login into HMI');
	}
	try {
		fetch(HMI_IP + HMI_DOWNLOAD_DATA, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
			timeout: 60000
		}).then((datos) => {
			let file = fs.createWriteStream('./public/Datos.csv');
			let stream = datos.body.pipe(file);
			stream.on('finish', () => {
				res.status(200).send();
			});
		});
	}
	catch (error) {
		console.error(error);
		res.status(500).send();
	}
}

async function ftpUpdateDatos() {
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) return console.error('Impossible to login into HMI');
	try {
		fetch(HMI_IP + HMI_DOWNLOAD_DATA, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
			timeout: 60000
		}).then((datos) => {
			let file = fs.createWriteStream('./public/DatosUpdate.csv');
			let stream = datos.body.pipe(file);
			stream.on('finish', () => {
				let ftpServer = new Client();
				ftpServer.on('ready', function () {
					ftpServer.put('./public/DatosUpdate.csv', 'DatosActual.csv', function (dataPutError) {
						if (dataPutError) throw dataPutError;
						ftpServer.end();
					});
				});
				ftpServer.connect({
					host: FTP_SERVER_DIRECTION,
					port: FTP_SERVER_PORT,
					user: FTP_SERVER_USER,
					password: FTP_SERVER_PASSWORD
				});
			});
		});
	}
	catch (error) {
		console.error(error);
		ftpUpdateDatos();
	}
}

async function ftpUpdateAlarmas() {
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) return console.error('Impossible to login into HMI');
	try {
		fetch(HMI_IP + HMI_DOWNLOAD_ALARMS, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
			timeout: 60000
		}).then((datos) => {
			let file = fs.createWriteStream('./public/AlarmasUpdate.csv');
			let stream = datos.body.pipe(file);
			stream.on('finish', () => {
				let ftpServer = new Client();
				ftpServer.on('ready', function () {
					ftpServer.put('./public/AlarmasUpdate.csv', 'AlarmasActual.csv', function (alarmsPutError) {
						if (alarmsPutError) throw alarmsPutError;
						ftpServer.end();
					});
				});
				ftpServer.connect({
					host: FTP_SERVER_DIRECTION,
					port: FTP_SERVER_PORT,
					user: FTP_SERVER_USER,
					password: FTP_SERVER_PASSWORD
				});
			});
		});
	}
	catch (error) {
		console.error(error);
		ftpUpdateAlarmas();
	}
}

async function ftpRecordDatos() {
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) return console.error('Impossible to login into HMI');
	try {
		fetch(HMI_IP + HMI_DOWNLOAD_DATA, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
			timeout: 60000
		}).then((datos) => {
			let file = fs.createWriteStream('./public/DatosRecord.csv');
			let stream = datos.body.pipe(file);
			stream.on('finish', () => {
				let date = new Date(Date.now());
				let ftpServer = new Client();
				ftpServer.on('ready', function () {
					ftpServer.put('./public/DatosRecord.csv', NOMBRE_ARCHIVO_DATOS + '_' + formatDate(date) + '.csv', function (dataPutError) {
						if (dataPutError) throw dataPutError;
						ftpServer.end();
					});
				});
				ftpServer.connect({
					host: FTP_SERVER_DIRECTION,
					port: FTP_SERVER_PORT,
					user: FTP_SERVER_USER,
					password: FTP_SERVER_PASSWORD
				});
			});
		});
	}
	catch (error) {
		console.error(error);
		ftpUpdateDatos();
	}
}

async function ftpRecordAlarmas() {
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) return console.error('Impossible to login into HMI');
	try {
		fetch(HMI_IP + HMI_DOWNLOAD_ALARMS, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
			timeout: 60000
		}).then((datos) => {
			let file = fs.createWriteStream('./public/AlarmasRecord.csv');
			let stream = datos.body.pipe(file);
			stream.on('finish', () => {
				let date = new Date(Date.now());
				let ftpServer = new Client();
				ftpServer.on('ready', function () {
					ftpServer.put('./public/AlarmasRecord.csv', NOMBRE_ARCHIVO_ALARMAS + '_' + formatDate(date) + '.csv', function (alarmsPutError) {
						if (alarmsPutError) throw alarmsPutError;
						ftpServer.end();
					});
				});
				ftpServer.connect({
					host: FTP_SERVER_DIRECTION,
					port: FTP_SERVER_PORT,
					user: FTP_SERVER_USER,
					password: FTP_SERVER_PASSWORD
				});
			});
		});
	}
	catch (error) {
		console.error(error);
		ftpUpdateDatos();
	}
}

async function loginIntoHMI() {
	try {
		console.log('HMI Login ' + HMI_IP + HMI_LOGIN);
		let loginRequest = await fetch(HMI_IP + HMI_LOGIN, {
			method: 'POST',
			body: 'Login=admin&Password=3333',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		});
		let cookiesArray = loginRequest.headers.get('set-cookie');
		let cookieValue = cookie.parse(cookiesArray);

		console.log(cookieValue['siemens_ad_session']);
		return cookieValue['siemens_ad_session'];
	} catch (e) {
		console.log(e);
		return false;
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