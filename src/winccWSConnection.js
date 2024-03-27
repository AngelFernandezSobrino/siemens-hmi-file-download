import { createWriteStream } from "fs";
import fetch from "node-fetch";
import timeoutSignal from "timeout-signal";
import { parse as cookieParser } from "cookie";
import { parse as htmlParser } from "node-html-parser";

import https from "https";

import fs from "fs";

import path from "path";

import { delay } from "./main.js";
import { pipeline } from "node:stream/promises";

export class WSApi {
  logger;
  session = "";

  

  constructor(hmiIp, hmiLoginPath, hmiUser, hmiPassword, logger) {
    this.logger = logger;
    this.hmiIp = hmiIp;
    this.hmiLoginPath = hmiLoginPath;
    this.hmiUser = hmiUser;
    this.hmiPassword = hmiPassword;
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
  }

  async authenticate() {
    try {
      this.logger.info(
        `Requesting cookie from https://${this.hmiIp}${this.hmiLoginPath}`
      );
      let loginRequest = await fetch(
        `https://${this.hmiIp}${this.hmiLoginPath}`,
        {
          method: "POST",
          body: `Login=${this.hmiUser}&Password=${this.hmiPassword}`,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          agent: this.httpsAgent,
        }
      );
      let cookieValue = cookieParser(
        loginRequest.headers.get("set-cookie") || ""
      );
      this.session = cookieValue["siemens_ad_secure_session"];
    } catch (e) {
      this.logger.error(`Error authenticating: ${e}`);
    }
  }

  async getPage(endpoint) {
    this.logger.info(`Requesting page ${endpoint} from ${this.hmiIp}`);
    return await fetch(`https://${this.hmiIp}${endpoint}`, {
      method: "GET",
      headers: { Cookie: "siemens_ad_secure_session=" + this.session },
      signal: timeoutSignal(5000),
      agent: this.httpsAgent,
    });
  }

  async getFilesInDeviceDirectory(directory) {
    let filesPageRequest = await this.getPage(
      directory + "?UP=TRUE&FORCEBROWSE"
    );
    let filesPageText = await filesPageRequest.text();
    let filesPageHtml = htmlParser(filesPageText);
    let filesTable = filesPageHtml.querySelectorAll(`a[href^="${directory}"]`);
    let filesOnDevice = [];
    filesTable.forEach((node) => {
      filesOnDevice.push({
        fileName: node.text,
        extension: "",
        noExtensionName: "",
        savePath: "",
        filePath: node.getAttribute("href") || "",
      });
    });
    return filesOnDevice;
  }

  async getFile(endpoint, savePath) {

    fs.mkdirSync(path.dirname(savePath), { recursive: true });
    this.logger.info(`Requesting file ${endpoint} from ${this.hmiIp}`);
    try {
      let data = await fetch(`https://${this.hmiIp}${endpoint}`, {
        method: "GET",
        headers: { Cookie: "siemens_ad_secure_session=" + this.session },
        signal: timeoutSignal(60000),
        agent: this.httpsAgent,
      });
      this.logger.info(`Saving file ${endpoint} to ${savePath}`);
      let file = createWriteStream(savePath);
      await pipeline(data.body, file);

      return true;
    } catch (e) {
      return false;
    }
  }

  async downloadAndSaveFile(savePath, filePath, maxRetries) {
    for (let retries = 0; ; retries++) {
      try {
        this.logger.info("Downloading file: " + filePath);
        await this.getFile(filePath, savePath);
        break;
      } catch (e) {
        this.logger.info("Error downloading file: " + filePath);
        this.logger.info(e);
        if (maxRetries < retries) {
          this.logger.info("Retrying in 10 seconds...");
          await delay(10000);
          continue;
        } else {
          this.logger.info("Max retries reached, aborting...");
          this.logger.info(e);
          throw e;
        }
      }
    }
  }
}
