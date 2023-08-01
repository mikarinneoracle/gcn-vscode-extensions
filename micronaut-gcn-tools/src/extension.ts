/*
 * Copyright (c) 2023, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import * as vscode from 'vscode';
import { micronautProjectExists, getJavaHome } from "./utils";
import { WelcomePanel } from './welcome';
import { builderInit, build } from './projectBuild';
import { createDeployment } from './kubernetes/kubernetesDeployment';
import { deployProject } from './kubernetes/kubernetesDeploy';
import { runProject, createService } from './kubernetes/kubernetesRun';
import * as symbols from './navigation/symbols';
import * as workspaceFolders from './navigation/workspaceFolders';
import * as views from './navigation/views';
import * as actions from './navigation/actions';
import * as targetAddress from './navigation/targetAddress';
import * as restQueries from './navigation/restQueries';
import * as kubernetes from 'vscode-kubernetes-tools-api';

export function activate(context: vscode.ExtensionContext) {
	symbols.initialize(context);
	workspaceFolders.initialize(context);
	views.initialize(context);
	actions.initialize(context);
	targetAddress.initialize(context);
	restQueries.initialize(context);

	if (vscode.workspace.getConfiguration().get<boolean>('micronaut-gcn.showWelcomePage')) {
		WelcomePanel.createOrShow(context);
	}
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.showWelcomePage', () => {
		WelcomePanel.createOrShow(context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.build', (goal?: string) => {
		build(goal, 'build');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.deploy', (goal?: string) => {
		build(goal, 'deploy');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.buildNativeImage', () => {
		vscode.commands.executeCommand('extension.micronaut-gcn.build', 'nativeImage');
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.kubernetes.createDeploy', () => {
		createDeployment(context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.kubernetes.deploy', () => {
		deployProject();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.kubernetes.createService', () => {
		createService(context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.kubernetes.run', () => {
		runProject();
	}));
	context.subscriptions.push(vscode.commands.registerCommand('extension.micronaut-gcn.oci.register', (ociNode) => {
		let id: string = ociNode.adbInstanceNodeProperties.adbInstanceID;
		let name: string = ociNode.adbInstanceNodeProperties.adbInstanceDisplayName;
		let info = {id, name};
		vscode.commands.executeCommand('nbls:Tools:org.netbeans.modules.cloud.oracle.actions.DownloadWalletAction', info);
	}));
	const graalVmExt = vscode.extensions.getExtension('oracle-labs-graalvm.graalvm');
	if (graalVmExt) {
		if (!graalVmExt.isActive) {
			graalVmExt.activate();
		}
		vscode.commands.executeCommand('setContext', 'graalVMExt.available', true);
	}
	micronautProjectExists().then(exists => {
		if (exists) {
			vscode.commands.executeCommand('setContext', 'micronautProjectExists', true);
			builderInit();
			const javaHome = getJavaHome();
			if (javaHome) {
				vscode.commands.executeCommand('setContext', 'javaHomeSet', true);
			}
			kubernetes.extension.kubectl.v1.then((kubectl => {
				if (kubectl.available) {
					vscode.commands.executeCommand('setContext', 'kubectl.available', true);
				}
			}));
		}
	});
}

export function deactivate() {}
