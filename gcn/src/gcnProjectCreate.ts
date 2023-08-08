/*
 * Copyright (c) 2023, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */
 
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as jdkUtils from 'jdk-utils';
import * as dialogs from "./dialogs";
import { getJavaVersion } from './graalvmUtils';
import {handleNewGCNProject} from './projectHandler';
import {
    initialize,
    selectCreateOptions,
    writeProjectContents,
    CreateOptions,
    JavaVMType,
    FileHandler
} from './common';


 /**
  * Global option
  */
 const LAST_PROJECT_PARENTDIR: string = 'lastCreateProjectParentDirs';


export async function createProject(context: vscode.ExtensionContext): Promise<void> {
    var options: CreateOptions | undefined;

    options = await initialize().then(async () => {
        let javaVMs = await getJavaVMs();
        return selectCreateOptions(javaVMs);
    });

    if (!options) {
        return;
    }

    /*
    for debugging

    options = {
        applicationType : 'APPLICATION',
        language: 'JAVA',
        micronautVersion: { label: '3.7.0', serviceUrl: ''},
        buildTool: 'GRADLE',
        testFramework: 'JUNIT',

        basePackage: 'com.example',
        projectName: 'demo',
        javaVersion: 'JDK_11'
    };
    */

    const targetLocation = await selectLocation(context, options);
    if (!targetLocation) {
        return;
    }
    return createProjectBase(context, options, targetLocation);
}

export async function createProjectBase(context: vscode.ExtensionContext, options : CreateOptions, targetLocation : string): Promise<void> {

    if (fs.existsSync(targetLocation)) {
        if (!fs.statSync(targetLocation).isDirectory()) {
            dialogs.showErrorMessage(`The selected location ${targetLocation} is not a directory.`);
            return;
        }
        if (fs.readdirSync(targetLocation).filter(n => n === '.' || n === '..' ? undefined : n).length > 0) {
            dialogs.showErrorMessage(`The selected location ${targetLocation} is not empty.`);
            return;
        }
    }

    if (!fs.existsSync(targetLocation)) {
        fs.mkdirSync(targetLocation, { recursive: true });
    }

    await writeProjectContents(options,new NodeFileHandler(vscode.Uri.file(targetLocation)));

    const uri = vscode.Uri.file(targetLocation);
    handleNewGCNProject(context, uri);
}

async function selectLocation(context: vscode.ExtensionContext, options: CreateOptions) {
    const lastDirs: any = context.globalState.get(LAST_PROJECT_PARENTDIR) || new Map<string, string>();
    const dirId = `${vscode.env.remoteName || ''}:${vscode.env.machineId}`;
    const dirName : string | undefined = lastDirs[dirId];
    let defaultDir: vscode.Uri | undefined;
    if (dirName) {
        try {
            defaultDir = vscode.Uri.parse(dirName, true);
        } catch (e) {
            defaultDir = undefined;
        }
    } else {
        defaultDir = undefined;
    }
    const location: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
        defaultUri: defaultDir,
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Choose Project Directory',
        openLabel: 'Create Here'
    });
    if (location && location.length > 0) {
        lastDirs[dirId] = location[0].toString();
        await context.globalState.update(LAST_PROJECT_PARENTDIR, lastDirs);
        let appName = options.basePackage;
        if (appName) {
            appName += '.' + options.projectName;
        } else {
            appName = options.projectName;
        }
        return path.join(location[0].fsPath, options.projectName);
    } else {
        return undefined;
    }
}

async function getJavaVMs(): Promise<JavaVMType[]> {
    const commands: string[] = await vscode.commands.getCommands();
    const javaVMs: JavaVMType[] = commands.includes('extension.graalvm.findGraalVMs') ? await vscode.commands.executeCommand('extension.graalvm.findGraalVMs') || [] : [];
    const javaRuntimes = await jdkUtils.findRuntimes({checkJavac: true});
    if (javaRuntimes.length) {
        for (const runtime of javaRuntimes) {
            if (runtime.hasJavac && !javaVMs.find(vm => path.normalize(vm.path) === path.normalize(runtime.homedir))) {
                const version = await getJavaVersion(runtime.homedir);
                if (version) {
                    javaVMs.push({name: version, path: runtime.homedir, active: false});
                }
            }
        }
    }
	const configJavaRuntimes = vscode.workspace.getConfiguration('java').get('configuration.runtimes', []) as any[];
    if (configJavaRuntimes.length) {
        for (const runtime of configJavaRuntimes) {
            if (runtime && typeof runtime === 'object' && runtime.path && !javaVMs.find(vm => path.normalize(vm.path) === path.normalize(runtime.path))) {
                const version = await getJavaVersion(runtime.path);
                if (version) {
                    javaVMs.push({name: version, path: runtime.path, active: runtime.default});
                }
            }
        }
    }
    javaVMs.sort((a, b) => {
        const nameA = a.name.toUpperCase();
        const nameB = b.name.toUpperCase();
        if (nameA < nameB) {
          return -1;
        }
        if (nameA > nameB) {
          return 1;
        }
        return 0;
    });

    return javaVMs;
}

/**
 * A Node.js implementation of FileHandler abstract class.
 */
export class NodeFileHandler extends FileHandler{

    constructor(locationUri:vscode.Uri){
        super(locationUri);
    }
    
    changeMode(fileUri: vscode.Uri, isExecutable: boolean): void {
        fs.chmodSync(fileUri.fsPath,isExecutable ? 0o777 : 0o666);
    }
}