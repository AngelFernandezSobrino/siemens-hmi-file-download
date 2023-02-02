import { createWriteStream } from 'fs';
import fetch from 'node-fetch';
import timeoutSignal from 'timeout-signal';
import { parse as cookieParser } from 'cookie';
import { parse as htmlParser } from 'node-html-parser';

import { delay } from './main.js';
export class WSApi {

    logger;
    session = '';

    constructor(hmiIp, hmiLoginPath, hmiUser, hmiPassword, logger) {
        this.logger = logger;
        this.hmiIp = hmiIp;
        this.hmiLoginPath = hmiLoginPath;
        this.hmiUser = hmiUser;
        this.hmiPassword = hmiPassword;
    }

    async authenticate() {
        try {
            this.logger.info(`Requesting cookie from http://${this.hmiIp}${this.hmiLoginPath}`);
            let loginRequest = await fetch(`http://${this.hmiIp}${this.hmiLoginPath}`, {
                method: 'POST',
                body: `Login=${this.hmiUser}&Password=${this.hmiPassword}`,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });
            let cookieValue = cookieParser(loginRequest.headers.get('set-cookie') || '');
            this.session = cookieValue['siemens_ad_session'];
        } catch (e) {
            this.logger.error(`Error authenticating: ${e}`);
        }
    }


    async getPage(endpoint) {
        this.logger.info(`Requesting page ${endpoint} from ${this.hmiIp}`);
        return await fetch(`http://${this.hmiIp}${endpoint}`, {
            method: 'GET',
            headers: { 'Cookie': 'siemens_ad_session=' + this.session },
            signal: timeoutSignal(5000)
        });
    }

    async getFilesInDeviceDirectory(directory) {

        let filesPageRequest = await this.getPage(directory + '?UP=TRUE&FORCEBROWSE');
        let filesPageHtml = htmlParser(await filesPageRequest.text());
        let filesTable = filesPageHtml.querySelectorAll('[href^="/StorageCardSD/"]');
        let filesOnDevice = [];
        filesTable.forEach((node) => {
            filesOnDevice.push({ fileName: node.text, extension: '', noExtensionName: '', savePath: '', filePath: node.getAttribute('href') || '' });
        });
        return filesOnDevice;
    }

    async getFile(endpoint, savePath) {
        return new Promise((resolve, reject) => {

            this.logger.info(`Requesting file ${endpoint} from ${this.hmiIp}`);
            fetch(`http://${this.hmiIp}${endpoint}`, {
                method: 'GET',
                headers: { 'Cookie': 'siemens_ad_session=' + this.session },
                signal: timeoutSignal(60000)
            }).then((data) => {
                this.logger.info(`Saving file ${endpoint} to ${savePath}`);
                let file = createWriteStream(savePath);
                let stream = data.body.pipe(file);
                stream.on('finish', () => {
                    resolve();
                });
                stream.on('error', (e) => {
                    console.log(e);
                    reject(e);
                });
            }).catch((e) => {
                console.log(e);
                reject(e);
            });

        });
    }

    async downloadAndSaveFile(savePath, filePath, maxRetries) {

        for (let retries = 0; ; retries++) {
            try {
                this.logger.info('Downloading file: ' + filePath)
                await this.getFile(filePath, savePath);
                break;
            } catch (e) {
                this.logger.info('Error downloading file: ' + filePath);
                this.logger.info(e);
                if (maxRetries < 6) {
                    this.logger.info('Retrying in 10 seconds...');
                    await delay(10000);
                    continue;
                } else {
                    this.logger.info('Max retries reached, aborting...');
                    this.logger.info(e);
                    throw e;
                }
            }
        }

    }
}