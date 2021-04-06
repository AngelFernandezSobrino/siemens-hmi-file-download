const schedule = require('node-schedule');
const express = require('express');
const fetch = require('node-fetch');
const Client = require('ftp');
const fs = require('fs');

// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 8080;

// eslint-disable-next-line no-undef
const HMI_IP = process.env.HMI_IP || '';
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

const HMI_LOGIN = 'https://reqres.in/api/users'; // 'LoginForm'
const HMI_DOWNLOAD_DATA = 'https://people.sc.fsu.edu/~jburkardt/data/csv/snakes_count_10.csv'; // '/StorageCardSD/Logs/Datos0.csv?UP=TRUE&FORCEBROWSE'
const HMI_DOWNLOAD_ALARMS = 'https://people.sc.fsu.edu/~jburkardt/data/csv/snakes_count_100.csv'; // '/StorageCardSD/Logs/Alarmas0.csv?UP=TRUE&FORCEBROWSE'

var app = express();

// eslint-disable-next-line no-unused-vars
const weekDataSaving = schedule.scheduleJob('0 23 * * 0', function () {
	ftpRecorder();
});

// eslint-disable-next-line no-unused-vars
const actualDataSaving = schedule.scheduleJob('0 * * * *', function () {
	ftpUpdate();
});

app.use(express.static('public'));


app.get('/descarga', (req, res) => {
	fileDownload(res);
});

app.listen(PORT, () => {
	console.info(`Server listening at port: ${PORT}`);
});

async function fileDownload(res) {
	let datos = fs.createWriteStream('./public/Datos.csv');
	let alarmas = fs.createWriteStream('./public/Alarmas.csv');
	console.info('HMI local data update');
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) return console.error('Impossible to login into HMI');
	try {
		let datosRequest = await fetch(HMI_IP + HMI_DOWNLOAD_DATA, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
		});
		await datosRequest.body.pipe(datos);
		let alarmasRequest = await fetch(HMI_IP + HMI_DOWNLOAD_ALARMS, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
		});
		await alarmasRequest.body.pipe(alarmas);

		res.status(200).send();
	}
	catch (error) {
		console.error(error);
		res.status(500).send();
	}
}

async function ftpUpdate() {
	let datosString = 'Error al recibir los datos del HMI';
	let alarmasString = 'Error al recibir los datos del HMI';
	console.info('HMI ftp data update');
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) return console.error('Impossible to login into HMI');
	try {
		let datosRequest = await fetch(HMI_IP + HMI_DOWNLOAD_DATA, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
		});
		let alarmasRequest = await fetch(HMI_IP + HMI_DOWNLOAD_ALARMS, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
		});
		datosString = await datosRequest.text();
		alarmasString = await alarmasRequest.text();

		var c = new Client();
		c.on('ready', function () {
			c.put(datosString, 'DatosActual.csv', function (dataPutError) {
				if (dataPutError) throw dataPutError;
				c.put(alarmasString, 'AlarmasActual.csv', function (alarmsPutError) {
					if (alarmsPutError) throw alarmsPutError;
					c.end();
				});
			});
		});
		c.connect({
			host: FTP_SERVER_DIRECTION,
			port: FTP_SERVER_PORT,
			user: FTP_SERVER_USER,
			password: FTP_SERVER_PASSWORD
		});
	}
	catch (error) {
		console.log(error);
	}
}

async function ftpRecorder() {
	let datosString = 'Error al recibir los datos del HMI';
	let alarmasString = 'Error al recibir los datos del HMI';
	console.log('HMI ftp data recording');
	let siemens_ad_session = await loginIntoHMI();
	if (!siemens_ad_session) return console.error('Impossible to login into HMI');
	try {
		let datosRequest = await fetch(HMI_IP + HMI_DOWNLOAD_DATA, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
		});
		let alarmasRequest = await fetch(HMI_IP + HMI_DOWNLOAD_ALARMS, {
			method: 'GET',
			headers: { 'Cookie': 'siemens_ad_session=' + siemens_ad_session },
		});
		datosString = await datosRequest.text();
		alarmasString = await alarmasRequest.text();

		let date = new Date(Date.now());

		var c = new Client();
		c.on('ready', function () {
			c.put(datosString, NOMBRE_ARCHIVO_DATOS + '_' + formatDate(date) + '.csv', function (datosPutError) {
				if (datosPutError) throw datosPutError;
				c.put(alarmasString, NOMBRE_ARCHIVO_ALARMAS + '_' + formatDate(date) + '.csv', function (alarmasPutError) {
					if (alarmasPutError) throw alarmasPutError;
					c.end();
				});
			});
		});
		// connect to localhost:21 as anonymous
		c.connect({
			host: FTP_SERVER_DIRECTION,
			port: FTP_SERVER_PORT,
			user: FTP_SERVER_USER,
			password: FTP_SERVER_PASSWORD
		});
	}
	catch (error) {
		console.log(error);
	}
}

async function loginIntoHMI() {
	try {
		console.log('HMI Data Fetch');
		let loginRequest = await fetch(HMI_IP + HMI_LOGIN, {
			method: 'POST',
			body: 'Login=admin&Password=3333',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		});
		console.log(loginRequest.headers.raw()['set-cookie']);
		return loginRequest.headers.raw()['set-cookie'];
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