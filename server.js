const schedule = require('node-schedule');
const express = require('express');
const fetch = require('node-fetch');
const Client = require('ftp');
const fs = require('fs');

const PORT = process.env.PORT;

const HMI_IP = process.env.HMI_IP || '';
const FTP_SERVER_DIRECTION = process.env.FTP_SERVER_DIRECTION;
const FTP_SERVER_PORT = process.env.FTP_SERVER_PORT;
const FTP_SERVER_USER = process.env.FTP_SERVER_USER;
const FTP_SERVER_PASSWORD = process.env.FTP_SERVER_PASSWORD;

const NOMBRE_ARCHIVO_DATOS = process.env.NOMBRE_ARCHIVO_DATOS;
const NOMBRE_ARCHIVO_ALARMAS = process.env.NOMBRE_ARCHIVO_ALARMAS;

const HMI_LOGIN = 'https://reqres.in/api/users'; // 'LoginForm'
const HMI_DOWNLOAD_DATA = 'https://people.sc.fsu.edu/~jburkardt/data/csv/snakes_count_10.csv'; // '/StorageCardSD/Logs/Datos0.csv?UP=TRUE&FORCEBROWSE'
const HMI_DOWNLOAD_ALARMS = 'https://people.sc.fsu.edu/~jburkardt/data/csv/snakes_count_100.csv'; // '/StorageCardSD/Logs/Alarmas0.csv?UP=TRUE&FORCEBROWSE'

app = express();

const job1 = schedule.scheduleJob('0 23 1 * *', function () {
    ftpRecorder();
});

const job2 = schedule.scheduleJob('0 * * * *', function () {
    ftpUpdate();
});
app.use(express.static('public'))
app.get('/descarga', (req, res) => {
    fileDownload(res);
})

app.listen(3000, () => {
    console.log(`Server listening at port: ${PORT}`)
  })

async function fileDownload(res) {
    let datos = fs.createWriteStream('./public/Datos.csv')
    let alarmas = fs.createWriteStream('./public/Alarmas.csv')
    try {
        console.log('HMI Data Fetch');
        loginRequest = await fetch(HMI_IP + HMI_LOGIN, {
            method: 'POST',
            body:    'Login=admin&Password=3333',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        console.log(loginRequest.headers.raw()['set-cookie']);
        let siemens_ad_session = loginRequest.headers.raw()['set-cookie'];

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
        console.log(error);
        res.status(500).send();
    }
}

async function ftpUpdate() {
    let datosString = 'Error al recibir los datos del HMI';
    let alarmasString = 'Error al recibir los datos del HMI';
    try {
        console.log('HMI Data Fetch');
        console.log(HMI_IP + HMI_LOGIN);
        loginRequest = await fetch(HMI_IP + HMI_LOGIN, {
            method: 'POST',
            // body:    'Login=admin&Password=3333',
            body: JSON.stringify({
                "name": "morpheus",
                "job": "leader"
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        console.log(loginRequest.headers.raw()['set-cookie']);
        let siemens_ad_session = loginRequest.headers.raw()['set-cookie'];

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
            c.put(datosString, 'DatosActual.csv', function (err) {
                if (err) throw err;
                c.put(alarmasString, 'AlarmasActual.csv', function (err) {
                    if (err) throw err;
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
    catch (err) {
        console.log(err)
    }
}

async function ftpRecorder() {
    let datosString = 'Error al recibir los datos del HMI';
    let alarmasString = 'Error al recibir los datos del HMI';
    try {
        console.log('HMI Data Fetch');
        loginRequest = await fetch(HMI_IP + HMI_LOGIN, {
            method: 'POST',
            body:    'Login=admin&Password=3333',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        console.log(loginRequest.headers.raw()['set-cookie']);
        let siemens_ad_session = loginRequest.headers.raw()['set-cookie'];

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
            c.put(datosString, NOMBRE_ARCHIVO_DATOS + '_' + formatDate(date) + '.csv', function (err) {
                if (err) throw err;
                c.put(alarmasString, NOMBRE_ARCHIVO_ALARMAS + '_' + formatDate(date) + '.csv', function (err) {
                    if (err) throw err;
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
    catch (err) {
        console.log(err)
    }
}

function formatDate(date) {
    const map = {
        mm: date.getMonth(),
        dd: date.getDate(),
        yyyy: date.getFullYear()
    }
    if (map.mm < 10) map.mm = '0' + map.mm;
    if (map.dd < 10) map.dd = '0' + map.dd;
    return map.yyyy + '_' + map.mm + '_' + map.dd
}