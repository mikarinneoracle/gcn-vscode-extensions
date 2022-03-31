/*
 * Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import * as https from 'https';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import * as utils from './utils';
import * as graalVMConfiguration from './graalVMConfiguration';

// const GDS_BASE = 'https://gds.oracle.com/api'; // production
const GDS_BASE = 'https://gds-stage.oraclecorp.com/api'; // staging
const GDS_VERSION = '20220101';
const ENDPOINT_ARTIFACTS = 'artifacts';
const ENDPOINT_TOKEN_REQUEST = 'tokenRequests';
const ENDPOINT_LICENSE_ACCEPTANCE = 'licenseAcceptance';
// const GRAALVM_PRODUCT_ID = 'D53FAE8052773FFAE0530F15000AA6C6'; // production
const GRAALVM_PRODUCT_ID = 'D35D04EC5DB2F1F6E0531614000A615C'; // staging
// const GRAALVM_PRODUCT_ID = 'DAF5A0AA0FD98D55E0531714000A901E'; // staging-devbuilds

const CONFIG_DIR = '.gu';
const CONFIG_FILE = 'config';

const DOWNLOAD_TOKEN_KEY = 'GRAAL_EE_DOWNLOAD_TOKEN';
export const DOWNLOAD_TOKEN_ENV = DOWNLOAD_TOKEN_KEY;

let PENDING_LICENSE_ACCEPTANCES_TOKEN: string | undefined = undefined;
let PENDING_LICENSE_ACCEPTANCES: string[] = [];

const VSCODE_AGENT = `VSCode/${vscode.version}`;
const SYSTEM_INFO = `${process.platform} ${process.arch}`;
const GRAALVMEXT_AGENT = `GraalVMext/${vscode.extensions.getExtension('oracle-labs-graalvm.graalvm')?.packageJSON.version}`;
const USER_AGENT = `${VSCODE_AGENT} (${SYSTEM_INFO}) ${GRAALVMEXT_AGENT}`;

const GET_RETRIES: number = 3;


export enum TokenOrigin {
    Env,
    File,
    CustomFile,
    User
}

export interface Token {
    value: string,
    origin: TokenOrigin,
    pendingLicense: boolean
}

export function showConfiguration() {
    getDownloadToken(false).then(token => {
        if (token?.value) {
            let origin: string | undefined;
            switch (token.origin) {
                case TokenOrigin.Env: {
                    origin = `environment variable ${DOWNLOAD_TOKEN_ENV}`;
                    break;
                }
                case TokenOrigin.File: {
                    const tokenfile = getTokenFile();
                    origin = `default configuration ${tokenfile}`;
                    break;
                }
                case TokenOrigin.CustomFile: {
                    const customTokenfile = getCustomTokenFile();
                    origin = `custom configuration ${customTokenfile}`;
                    break;
                }
                default: {
                    origin = undefined;
                }
            }
            if (origin) {
                const action = 'Copy Token to Clipboard';
                const msg = `Download token is currently defined in ${origin}.`;
                vscode.window.showInformationMessage(msg, action).then(value => {
                    if (value === action) {
                        vscode.env.clipboard.writeText(token.value);
                    }
                });
                return;
            }
        }
        vscode.window.showInformationMessage('No download token is currently defined.');
    });
}

export async function getEEArtifactURL(artifactId: string, licenseId: string): Promise<string | undefined> {
    try {
        const token = await getDownloadToken(true, licenseId);
        if (token) {
            if (token.pendingLicense) {
                if (!await proceedAfterLicenseConfirmation()) {
                    return undefined;
                }
            }
            try {
                const link = await getArtifactLocation(artifactId, token.value);
                if (link) {
                    handleValidToken(token);
                    licenseAccepted(token.value, licenseId);
                    return link;
                } else {
                    vscode.window.showErrorMessage('Failed to obtain download location');
                }
            } catch (e) {
                if (e.code === 401 && e.status === 'InvalidLicenseAcceptance') {
                    handleValidToken(token);
                    if (isLicenseAcceptancePending(token.value, licenseId)) {
                        if (await proceedAfterLicenceAcceptance()) {
                            return getEEArtifactURL(artifactId, licenseId);
                        }
                    } else {
                        try {
                            // NOTE: acceptLicense(token, licenseId) may return InvalidToken/UnverifiedToken
                            //       but this shouldn't happen here as it would be thrown directly from getArtifactLocation(artifactId, token)
                            await acceptLicense(token.value, licenseId);
                            licenseRequired(token.value, licenseId);
                            if (await proceedAfterLicenseConfirmation()) {
                                return getEEArtifactURL(artifactId, licenseId);
                            }
                        } catch (e) {
                            let msg = 'Failed to request required license confirmation';
                            if (e.message) {
                                msg += `: ${e.message}`;
                            }
                            vscode.window.showErrorMessage(msg);
                        }
                    }
                } else if (e.code === 401 && e.status === 'UnverifiedToken') {
                    handleValidToken(token);
                    if (await proceedAfterTokenVerification()) {
                        return getEEArtifactURL(artifactId, licenseId);
                    }
                } else if (e.code === 401 && e.status === 'InvalidToken') {
                    const retry = handleInvalidToken(token);
                    if (retry) {
                        return getEEArtifactURL(artifactId, licenseId);
                    }
                } else {
                    let msg = 'Failed to obtain requested download';
                    if (e.message) {
                        msg += `: ${e.message}`;
                    }
                    vscode.window.showErrorMessage(msg);
                }
            }
        }
    } catch (err) {
        vscode.window.showErrorMessage(err?.message);
    }
    return undefined;
}

const INVALID_TOKEN = 'is not valid.';
const UNVERIFIED_TOKEN = 'has not been validated yet, check your e-mail.';
const LICENSE_PENDING = 'License has been sent to your Email';

export function getGUErrorType(guMessage: string): string | undefined {
    if (guMessage.includes(INVALID_TOKEN)) {
        return INVALID_TOKEN;
    } else if (guMessage.includes(UNVERIFIED_TOKEN)) {
        return UNVERIFIED_TOKEN;
    } else if (guMessage.includes(LICENSE_PENDING)) {
        return LICENSE_PENDING;
    }
    return undefined;
}

export function isHandledGUError(error: any): boolean {
    return error?.code === 5;
}

export async function handleGUError(token: Token, guErrorType: string): Promise<boolean> {
    switch (guErrorType) {
        case LICENSE_PENDING: {
            handleValidToken(token);
            if (await proceedAfterLicenseConfirmation()) {
                return true;
            }
            break;
        }
        case UNVERIFIED_TOKEN: {
            handleValidToken(token);
            if (await proceedAfterTokenVerification()) {
                return true;
            }
            break;
        }
        case INVALID_TOKEN: {
            const retry = handleInvalidToken(token);
            if (retry) {
                const newToken = await getDownloadToken(true);
                if (newToken) {
                    token.value = newToken.value;
                    token.origin = newToken.origin;
                    token.pendingLicense = newToken.pendingLicense;
                    return true;
                }
            }
            break;
        }
    }
    return false;
}

async function proceedAfterLicenseConfirmation(): Promise<boolean> {
    const proceed = 'Continue Download';
    const message = `License for this download has been sent to the email address which generated the download token. Follow the steps in the email and then click ${proceed} to proceed with the download, or invoke the download action again.`;
    return await delayedProceed(proceed, message);
}

async function proceedAfterTokenVerification(): Promise<boolean> {
    const proceed = 'Continue Download';
    const message = `The download token has not been verified yet. Follow the steps sent to the email address which generated the download token and then click ${proceed} to proceed with the download, or invoke the download action again.`;
    return await delayedProceed(proceed, message, true);
}

async function proceedAfterLicenceAcceptance(): Promise<boolean> {
    const proceed = 'Continue Download';
    const message = `The license for this download has not been accepted yet. Follow the steps sent to the email address which generated the download token and then click ${proceed} to proceed with the download, or invoke the download action again.`;
    return await delayedProceed(proceed, message, true);
}

async function delayedProceed(proceed: string, message: string, warning: boolean = false): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        if (warning) {
            vscode.window.showWarningMessage(message, proceed).then(value => {
                resolve(value === proceed);
            });
        } else {
            vscode.window.showInformationMessage(message, proceed).then(value => {
                resolve(value === proceed);
            });
        }
    });
}

export async function getDownloadToken(interactive: boolean, licenseId?: string): Promise<Token | undefined> {
    // Download token defined in custom config file
    const customTokenFile = getCustomTokenFile();
    if (customTokenFile !== undefined && customTokenFile.trim().length > 0) {
        const customFileToken = readTokenFromFile(customTokenFile);
        if (customFileToken) {
            return { value: customFileToken, origin: TokenOrigin.CustomFile, pendingLicense: false };
        } else {
            vscode.window.showErrorMessage('Custom GU configuration file does not exist or does not contain the download token.');
            return undefined;
        }
    }
    // Download token defined in GRAAL_EE_DOWNLOAD_TOKEN environment variable
    const envToken = process.env[DOWNLOAD_TOKEN_ENV];
    if (envToken) {
        return { value: envToken, origin: TokenOrigin.Env, pendingLicense: false };
    }
    // Download token defined in ~/.graalvm/config file
    const fileToken = readTokenFromFile();
    if (fileToken) {
        return { value: fileToken, origin: TokenOrigin.File, pendingLicense: false };
    }
    if (interactive) {
        // Download token provided/generated interactively by the user
        const userToken = await requestDownloadToken(licenseId);
        if (userToken?.value) {
            return userToken;
        }
    }
    return undefined;
}

function handleValidToken(token: Token) {
    if (token.origin === TokenOrigin.User) {
        saveTokenToFile(token.value);
    }
}

function handleInvalidToken(token: Token): boolean {
    switch (token.origin) {
        case TokenOrigin.User: {
            vscode.window.showErrorMessage('The provided download token is invalid or has expired.');
            return true; // ask to provide another/generate new token
        }
        case TokenOrigin.File: {
            const cleared = saveTokenToFile(''); // clear the invalid saved token
            vscode.window.showErrorMessage('The download token is invalid or has expired.');
            return cleared; // ask to provide another/generate new token only if the invalid token has been cleared
        }
        case TokenOrigin.CustomFile: {
            vscode.window.showErrorMessage('The download token in custom file is invalid or has expired.');
            break;
        }
        case TokenOrigin.Env: {
            vscode.window.showErrorMessage(`The download token defined in $${DOWNLOAD_TOKEN_ENV} is invalid or has expired.`);
            break;
        }
    }
    return false; // just notify and don't proceed
}

async function requestDownloadToken(licenseId?: string): Promise<Token | undefined> {
    let input = await vscode.window.showInputBox({
        placeHolder: 'Enter existing download token or provide email address to generate a new download token',
        validateInput: async (val) => val.indexOf('@') > -1 ? validateEmail(val) : validateToken(val),
        ignoreFocusOut: true
    });
    if (input) {
        input = input.trim();
        if (input.indexOf('@') > -1) {
            const token = await generateToken(input, licenseId);
            if (token) {
                const saved = saveTokenToFile(token);
                return { value: token, origin: saved ? TokenOrigin.File : TokenOrigin.User, pendingLicense: licenseId !== undefined };
            }
        } else {
            const saved = saveTokenToFile(input);
            return { value: input, origin: saved ? TokenOrigin.File : TokenOrigin.User, pendingLicense: false };
        }
    }
    return undefined;
}

async function generateToken(address: string, licenseId?: string): Promise<string | undefined> {
    if (licenseId) {
        try {
            const token = await requestTokenAcceptLicense(address, licenseId);
            if (token) {
                const action = 'Copy to Clipboard';
                const msg = `New download token for email address ${address} has been generated.`;
                vscode.window.showInformationMessage(msg, action).then(value => {
                    if (value === action) {
                        const clipboard = `Download token for email address ${address} is ${token}`;
                        vscode.env.clipboard.writeText(clipboard);
                    }
                });
                return token;
            } else {
                vscode.window.showErrorMessage('Failed to obtain download token');
            }
        } catch (e) {
            let msg = 'Failed to obtain download token';
            if (e.message) {
                msg += `: ${e.message}`;
            }
            vscode.window.showErrorMessage(msg);
        }
    } else {
        try {
            await requestToken(address);
            const message = `Download token has been sent to ${address}. Follow the steps in the email and enter the download token.`;
            vscode.window.showInformationMessage(message);
            let token = await vscode.window.showInputBox({
                placeHolder: 'Enter the generated download token',
                validateInput: async (val) => validateToken(val),
                ignoreFocusOut: true
            });
            return token;
        } catch (e) {
            let msg = 'Failed to obtain download token';
            if (e.message) {
                msg += `: ${e.message}`;
            }
            vscode.window.showErrorMessage(msg);
        }
    }
    return undefined;
}

function validateEmail(email: string): string | undefined {
    if (email) {
        email = email.trim();
    }
    if (!email || email.length === 0) {
        return 'Empty email address';
    }
    const idx = email.indexOf('@');
    if (idx < 1 || idx > email.length - 2) {
        return 'Invalid email address format';
    }
    return undefined;
}

function validateToken(token: string): string | undefined {
    if (token) {
        token = token.trim();
    }
    if (!token || token.length === 0) {
        return 'Empty token';
    }
    return undefined;
}

// List all available GraalVM EE Core downloads
export async function getGraalVMEECoreArtifacts() {
    const limit = '1000'; // maximum supported
    const page = '0';
    let os: string = process.platform;
    if (os === 'win32') {
        os = 'windows';
    }
    const arch = utils.getArch();
    const isBase = 'True';
    const edition = 'ee';
    const supported = 'True';
    // const supported = 'False';
    const status = 'PUBLISHED';
    const includeMetadata = 'notFilteredOnly';
    const responseFields1 = 'id';
    const responseFields2 = 'licenseId';
    const responseFields3 = 'metadata';
    const sortOrder = 'DESC';
    const sortBy = 'timeCreated';
    // Throws error for broken gunzip, catched by the caller
    const response = await getDataRetry(`${ENDPOINT_ARTIFACTS}?metadata=arch%3A${arch}&metadata=os%3A${os}&metadata=isBase%3A${isBase}&metadata=edition%3A${edition}&metadata=supported%3A${supported}&productId=${GRAALVM_PRODUCT_ID}&status=${status}&includeMetadata=${includeMetadata}&responseFields=${responseFields1}&responseFields=${responseFields2}&responseFields=${responseFields3}&limit=${limit}&page=${page}&sortOrder=${sortOrder}&sortBy=${sortBy}`);
    if (response.code === 200) {
        const artifacts = JSON.parse(response.data);
        return artifacts;
    }
    let data: any = undefined;
    if (response.data) {
        try {
            data = JSON.parse(response.data);
        } catch (err) {
            data = { message: 'Unrecognized server response' };
        }
    }
    throw { code: response.code, status: data?.code, message: data?.message };
}

// Request download token using email address (no license)
async function requestToken(emailAddress: string): Promise<void> {
    const requestData = {
        'email': emailAddress,
        'type': 'GENERATE'
    };
    // May throw error, catched by the caller
    const response = await postData(ENDPOINT_TOKEN_REQUEST, requestData);
    if (response.code === 204) {
        return;
    }
    let data: any = undefined;
    if (response.data) {
        try {
            data = JSON.parse(response.data);
        } catch (err) {
            data = { message: 'Unrecognized server response' };
        }
    }
    throw { code: response.code, status: data?.code, message: data?.message };
}

// Generate download token using email address and accept a license
async function requestTokenAcceptLicense(emailAddress: string, licenseId: string): Promise<string> {
    const requestData = {
        'email': emailAddress,
        'licenseId': licenseId,
        'type': 'GENERATE_TOKEN_AND_ACCEPT_LICENSE'
    };
    // May throw error, catched by the caller
    const response = await postData(ENDPOINT_LICENSE_ACCEPTANCE, requestData);
    if (response.code === 200 && response.data) {
        const data = JSON.parse(response.data);
        return data.token;
    }
    let data: any = undefined;
    if (response.data) {
        try {
            data = JSON.parse(response.data);
        } catch (err) {
            data = { message: 'Unrecognized server response' };
        }
    }
    throw { code: response.code, status: data?.code, message: data?.message };
}

// Accept (additional) license using download token
async function acceptLicense(token: string, licenseId: string): Promise<void> {
    const requestData = {
        'token': token,
        'licenseId': licenseId
    };
    // May throw error, catched by the caller
    const response = await postData(ENDPOINT_LICENSE_ACCEPTANCE, requestData);
    if (response.code === 204) {
        return;
    }
    let data: any = undefined;
    if (response.data) {
        try {
            data = JSON.parse(response.data);
        } catch (err) {
            data = { message: 'Unrecognized server response' };
        }
    }
    throw { code: response.code, status: data?.code, message: data?.message };
}

// Get the download link for an artifact
async function getArtifactLocation(artifactId: string, token: string): Promise<string> {
    const options: https.RequestOptions = {
        headers: {
            'x-download-token': token
        }
    };
    // May throw error, catched by the caller
    const response = await getDataRetry(`${ENDPOINT_ARTIFACTS}/${artifactId}/content`, options);
    if (response.code === 302 && response.headers?.location) {
        return response.headers.location;
    }
    let data: any = undefined;
    if (response.data) {
        try {
            data = JSON.parse(response.data);
        } catch (err) {
            data = { message: 'Unrecognized server response' };
        }
    }
    throw { code: response.code, status: data?.code, message: data?.message };
}

async function getDataRetry(endpoint: string, options: https.RequestOptions = {}, retries: number = GET_RETRIES): Promise<{ code: number | undefined, headers: any, data: any }> {
    const response = await getData(endpoint, options);
    if (retries > 1 && response?.code && response.code >= 500) {
        return getDataRetry(endpoint, options, retries - 1);
    } else {
        return response;
    }
}

async function getData(endpoint: string, options: https.RequestOptions = {}): Promise<{ code: number | undefined, headers: any, data: any }> {
    console.log('## GETDATA '  + endpoint);
    return new Promise((resolve, reject) => {
        const addr = `${GDS_BASE}/${GDS_VERSION}/${endpoint}`;
        if (!options.headers) {
            options.headers = {};
        }
        options.headers['User-Agent'] = USER_AGENT;
        options.headers['Accept-Encoding'] = 'gzip';
        https.get(addr, options, res => {
            let data: any[] = [];
            res.on('data', chunk => {
                data.push(chunk);
            });
            res.on('end', () => {
                let cdata = Buffer.concat(data);
                if (res.headers['content-encoding'] === 'gzip') {
                    try {
                        cdata = zlib.gunzipSync(cdata);
                    } catch (err) {
                        reject(err);
                    }
                }
                const response = cdata.toString();
                resolve({ code: res.statusCode, headers: res.headers, data: response });
            });
        }).on('error', err => {
            reject(err);
        });
    });
}

async function postData(endpoint: string, data: any, options: https.RequestOptions = {}): Promise<{ code: number | undefined, headers: any, data: any }> {
    return new Promise((resolve, reject) => {
        const addr = `${GDS_BASE}/${GDS_VERSION}/${endpoint}`;
        options.method = 'POST';
        if (!options.headers) {
            options.headers = {};
        }
        options.headers['User-Agent'] = USER_AGENT;
        options.headers['Content-Type'] = 'application/json';
        var req = https.request(addr, options, res => {
            let data: any[] = [];
            res.on('data', chunk => {
                data.push(chunk);
            });
            res.on('end', () => {
                const response = Buffer.concat(data).toString();
                resolve({ code: res.statusCode, headers: res.headers, data: response });
            });
        }).on('error', err => {
            reject(err);
        });
        req.write(JSON.stringify(data));
        req.end();
    });
}

function licenseRequired(token: string, licenseId: string) {
    checkLicenseToken(token);
    if (!PENDING_LICENSE_ACCEPTANCES.includes(licenseId)) {
        PENDING_LICENSE_ACCEPTANCES.push(licenseId);
    }
}

function licenseAccepted(token: string, licenseId: string) {
    checkLicenseToken(token);
    const idx = PENDING_LICENSE_ACCEPTANCES.indexOf(licenseId);
    if (idx > -1) {
        PENDING_LICENSE_ACCEPTANCES.splice(idx, 1);
    }
}

function isLicenseAcceptancePending(token: string, licenseId: string): boolean {
    checkLicenseToken(token);
    return PENDING_LICENSE_ACCEPTANCES.includes(licenseId);
}

function checkLicenseToken(token: string) {
    if (token !== PENDING_LICENSE_ACCEPTANCES_TOKEN) {
        PENDING_LICENSE_ACCEPTANCES_TOKEN = token;
        PENDING_LICENSE_ACCEPTANCES = [];
    }
}

function getTokenFile(): string {
    const homedir = os.homedir();
    const credfile = path.join(homedir, CONFIG_DIR, CONFIG_FILE);
    return credfile;
}

function getCustomTokenFile(): string | undefined {
    const gvmConfig = graalVMConfiguration.getGVMConfig();
    if (gvmConfig) {
        const file = gvmConfig.get('gu.config') as string;
        return file;
    }
    return undefined;
}

function readTokenFromFile(tokenfile?: string): string | undefined {
    if (!tokenfile) {
        tokenfile = getTokenFile();
    }
    const lines = readLines(tokenfile);
    return getProperty(DOWNLOAD_TOKEN_KEY, lines);
}

function saveTokenToFile(token: string): boolean {
    const tokenfile = getTokenFile();
    const lines = readLines(tokenfile);
    setProperty(DOWNLOAD_TOKEN_KEY, token, lines)
    return writeLines(tokenfile, lines);
}

function getProperty(key: string, lines: string[]): string | undefined {
    for (let line of lines) {
        const valueIndex = getValueIndex(key, line);
        if (valueIndex > 0) {
            return line.substring(valueIndex);
        }
    }
    return undefined;
}

function setProperty(key: string, value: string, lines: string[]): boolean {
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const valueIndex = getValueIndex(key, line);
        if (valueIndex > 0) {
            // Rewrite existing key
            lines[i] = line.substring(0, valueIndex) + value;
            return false;
        }
    }
    // Append new key
    if (lines.length > 0 && lines[lines.length - 1].length === 0) {
        // Append before trailing newline
        lines[lines.length - 1] = `${key}=${value}\n`;
    } else {
        // Insert new line
        lines.push(`${key}=${value}`);
    }
    return true;
}

function isComment(line: string) {
    return line.startsWith('#') || line.startsWith('!');
}

function getValueIndex(key: string, line: string): number {
    if (!isComment(line)) {
        const equalsIndex = line.indexOf('=');
        if (equalsIndex === key.length && line.substring(0, equalsIndex) === key) {
            return equalsIndex + 1;
        }
    }
    return -1;
}

function readLines(file: string): string[] {
    try {
        const lines = fs.readFileSync(file).toString();
        return lines.length === 0 ? [] : lines.split(/\r?\n/);
    } catch (err) {
        return [];
    }
}

function writeLines(file: string, lines: string[]): boolean {
    try {
        const folder = path.dirname(file);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, 0o700);
        }
        fs.writeFileSync(file, '', { flag: 'w', mode: 0o600 });
        for (let i = 0; i < lines.length; i++) {
            const line = i < lines.length - 1 ? `${lines[i]}\n` : lines[i];
            fs.writeFileSync(file, line, { flag: 'a', encoding: 'utf8' });
        }
        return true;
    } catch (err) {
        return false;
    }
}
