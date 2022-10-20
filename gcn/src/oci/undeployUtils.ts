/*
 * Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as identity from 'oci-identity';
import * as devops from 'oci-devops';
import * as gcnServices from '../gcnServices';
import * as dialogs from '../dialogs';
import * as model from '../model';
import * as projectUtils from '../projectUtils';
import * as logUtils from '../logUtils';
import * as ociAuthentication from './ociAuthentication';
import * as ociUtils from './ociUtils';
import * as ociServices from './ociServices';


export async function undeploy(folders: gcnServices.FolderData[], deployData: any, dump: model.DumpDeployData): Promise<void> {
    logUtils.logInfo('[undeploy] Invoked delete devops project');

    const authentication = await ociAuthentication.resolve(deployData.profile);
    if (!authentication) {
        return;
    }
    const configurationProblem = authentication.getConfigurationProblem();
    if (configurationProblem) {
        dialogs.showErrorMessage(configurationProblem);
        return;
    }
    const provider = authentication.getProvider();

    const error: string | undefined = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Deleting devops project',
        cancellable: false
    }, (progress, _token) => {
        return new Promise(async resolve => {
            const projectName = deployData.project?.name;
            if (deployData.repositories) {
                const repositoriesCnt = deployData.repositories.length;
                for (const repositoryName in deployData.repositories) {
                    const folderData = deployData.repositories[repositoryName];
                    if (folderData) {
                        if (folderData.subs) {
                            for (const subName in folderData.subs) {
                                const subData = folderData.subs[subName];
                                if (subData) {
                                    if (subData.deployToOkeStage) {
                                        try {
                                            progress.report({ message: `Deleting ${subName} docker native executables deployment to OKE stage for ${repositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting deploy to OKE stage of deployment to OKE pipeline for ${subName} docker native executables of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteDeployStage(provider, subData.deployToOkeStage, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete ${subName} docker native executables deployment to OKE stage for ${repositoryName}`, err));
                                            return;
                                        }
                                        delete subData.deployToOkeStage;
                                        dump(deployData);
                                    }
                                    if (subData.oke_deployPipeline) {
                                        try {
                                            progress.report({ message: `Deleting ${subName} docker native executables deployment to OKE pipeline for ${repositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting deployment to OKE pipeline for ${subName} docker native executables of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteDeployPipeline(provider, subData.oke_deployPipeline, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete ${subName} docker native executables deployment to OKE pipeline for ${repositoryName}`, err));
                                            return;
                                        }
                                        delete subData.oke_deployPipeline;
                                        dump(deployData);
                                    }
                                    if (subData.oke_deployConfigArtifact) {
                                        try {
                                            progress.report({ message: `Deleting OKE deployment configuration artifact for ${subName} of ${repositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting OKE deployment configuration artifact for ${subName} of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteDeployArtifact(provider, subData.oke_deployConfigArtifact, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete OKE deployment configuration artifact for ${subName} of ${repositoryName}`, err));
                                            return;
                                        }
                                        delete subData.oke_deployConfigArtifact;
                                        dump(deployData);
                                    }
                                    if (subData.docker_nibuildPipelineArtifactsStage) {
                                        try {
                                            progress.report({ message: `Deleting ${subName} docker native executable pipeline artifacts stage for ${repositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting artifacts stage of build pipeline for ${subName} docker native executable of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteBuildPipelineStage(provider, subData.docker_nibuildPipelineArtifactsStage, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete ${subName} docker native executable pipeline artifacts stage for ${repositoryName}`, err));
                                            return;
                                        }
                                        delete subData.docker_nibuildPipelineArtifactsStage;
                                        dump(deployData);
                                    }
                                    if (subData.docker_nibuildPipelineBuildStage) {
                                        try {
                                            progress.report({ message: `Deleting ${subName} docker native executable pipeline build stage for ${repositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting build stage of build pipeline for ${subName} docker native executable of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteBuildPipelineStage(provider, subData.docker_nibuildPipelineBuildStage, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete ${subName} docker native executable pipeline build stage for ${repositoryName}`, err));
                                            return;
                                        }
                                        delete subData.docker_nibuildPipelineBuildStage;
                                        dump(deployData);
                                    }
                                    if (subData.docker_nibuildPipeline) {
                                        try {
                                            progress.report({ message: `Deleting ${subName} docker native executable build pipeline for ${repositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting build pipeline for ${subName} docker native executable of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteBuildPipeline(provider, subData.docker_nibuildPipeline, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete ${subName} docker native executable build pipeline for ${repositoryName}`, err));
                                            return;
                                        }
                                        delete subData.docker_nibuildPipeline;
                                        dump(deployData);
                                    }
                                    if (subData.docker_nibuildArtifact) {
                                        try {
                                            progress.report({ message: `Deleting ${subName} docker native executable artifact for ${repositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting ${subName} docker native executable artifact for ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteDeployArtifact(provider, subData.docker_nibuildArtifact, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete ${subName} docker native executable artifact for ${repositoryName}`, err));
                                            return;
                                        }
                                        delete subData.docker_nibuildArtifact;
                                        dump(deployData);
                                    }
                                    if (subData.containerRepository) {
                                        const containerRepositoryName = repositoriesCnt > 1 ? `${projectName}-${repositoryName}-${subName}` : `${projectName}-${subName}`;
                                        try {
                                            progress.report({ message: `Deleting container repository ${containerRepositoryName}...` });
                                            logUtils.logInfo(`[undeploy] Deleting container repository for ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                            await ociUtils.deleteContainerRepository(provider, subData.containerRepository, true);
                                        } catch (err) {
                                            resolve(dialogs.getErrorMessage(`Failed to delete container repository ${containerRepositoryName}`, err));
                                            return;
                                        }
                                        delete subData.containerRepository;
                                        dump(deployData);
                                    }
                                    if (Object.keys(subData).length === 0) {
                                        delete folderData.subs[subName];
                                        dump(deployData);
                                    }
                                }
                            }
                        }
                        if (folderData.deployToOkeStage) {
                            try {
                                progress.report({ message: `Deleting docker native executables deployment to OKE stage for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting deploy to OKE stage of deployment to OKE pipeline for docker native executables of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteDeployStage(provider, folderData.deployToOkeStage, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete docker native executables deployment to OKE stage for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.deployToOkeStage;
                            dump(deployData);
                        }
                        if (folderData.oke_deployPipeline) {
                            try {
                                progress.report({ message: `Deleting docker native executables deployment to OKE pipeline for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting deployment to OKE pipeline for docker native executables of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteDeployPipeline(provider, folderData.oke_deployPipeline, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete docker native executables deployment to OKE pipeline for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.oke_deployPipeline;
                            dump(deployData);
                        }
                        if (folderData.oke_deployConfigArtifact) {
                            try {
                                progress.report({ message: `Deleting OKE deployment configuration artifact for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting OKE deployment configuration artifact for ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteDeployArtifact(provider, folderData.oke_deployConfigArtifact, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete OKE deployment configuration artifact for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.oke_deployConfigArtifact;
                            dump(deployData);
                        }
                        if (folderData.docker_nibuildPipelineArtifactsStage) {
                            try {
                                progress.report({ message: `Deleting docker native executable pipeline artifacts stage for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting artifacts stage of build pipeline for docker native executable of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipelineStage(provider, folderData.docker_nibuildPipelineArtifactsStage, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete docker native executable pipeline artifacts stage for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.docker_nibuildPipelineArtifactsStage;
                            dump(deployData);
                        }
                        if (folderData.docker_nibuildPipelineBuildStage) {
                            try {
                                progress.report({ message: `Deleting docker native executable pipeline build stage for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting build stage of build pipeline for docker native executable of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipelineStage(provider, folderData.docker_nibuildPipelineBuildStage, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete docker native executable pipeline build stage for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.docker_nibuildPipelineBuildStage;
                            dump(deployData);
                        }
                        if (folderData.docker_nibuildPipeline) {
                            try {
                                progress.report({ message: `Deleting docker native executable build pipeline for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting build pipeline for docker native executable of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipeline(provider, folderData.docker_nibuildPipeline, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete docker native executable build pipeline for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.docker_nibuildPipeline;
                            dump(deployData);
                        }
                        if (folderData.docker_nibuildArtifact) {
                            try {
                                progress.report({ message: `Deleting docker native executable artifact for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting docker native executable artifact for ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteDeployArtifact(provider, folderData.docker_nibuildArtifact, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete docker native executable artifact for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.docker_nibuildArtifact;
                            dump(deployData);
                        }
                        if (folderData.containerRepository) {
                            const containerRepositoryName = repositoriesCnt > 1 ? `${projectName}-${repositoryName}` : projectName;
                            try {
                                progress.report({ message: `Deleting container repository ${containerRepositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting container repository for ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteContainerRepository(provider, folderData.containerRepository, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete container repository ${containerRepositoryName}`, err));
                                return;
                            }
                            delete folderData.containerRepository;
                            dump(deployData);
                        }
                        if (folderData.nibuildPipelineArtifactsStage) {
                            try {
                                progress.report({ message: `Deleting native executables pipeline artifacts stage for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting artifacts stage of build pipeline for native executables of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipelineStage(provider, folderData.nibuildPipelineArtifactsStage, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete native executables pipeline artifacts stage for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.nibuildPipelineArtifactsStage;
                            dump(deployData);
                        }
                        if (folderData.nibuildPipelineBuildStage) {
                            try {
                                progress.report({ message: `Deleting native executables pipeline build stage for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting build stage of build pipeline for native executables o ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipelineStage(provider, folderData.nibuildPipelineBuildStage, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete native executables pipeline build stage for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.nibuildPipelineBuildStage;
                            dump(deployData);
                        }
                        if (folderData.nibuildPipeline) {
                            try {
                                progress.report({ message: `Deleting native executables pipeline for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting build pipeline for native executables of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipeline(provider, folderData.nibuildPipeline, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete native executables pipeline for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.nibuildPipeline;
                            dump(deployData);
                        }
                        if (folderData.nibuildArtifact) {
                            try {
                                progress.report({ message: `Deleting native executable artifact for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting native executable artifact for ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteDeployArtifact(provider, folderData.nibuildArtifact, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete native executable artifact for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.nibuildArtifact;
                            dump(deployData);
                        }
                        if (folderData.devbuildPipelineArtifactsStage) {
                            try {
                                progress.report({ message: `Deleting fat JAR pipeline artifacts stage for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting artifacts stage of build pipeline for fat JARs of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipelineStage(provider, folderData.devbuildPipelineArtifactsStage, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete fat JAR pipeline artifacts stage for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.devbuildPipelineArtifactsStage;
                            dump(deployData);
                        }
                        if (folderData.devbuildPipelineBuildStage) {
                            try {
                                progress.report({ message: `Deleting fat JAR pipeline build stage for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting build stage of build pipeline for fat JARs of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipelineStage(provider, folderData.devbuildPipelineBuildStage, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete fat JAR pipeline build stage for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.devbuildPipelineBuildStage;
                            dump(deployData);
                        }
                        if (folderData.devbuildPipeline) {
                            try {
                                progress.report({ message: `Deleting fat JAR pipeline for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting build pipeline for fat JARs of ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteBuildPipeline(provider, folderData.devbuildPipeline, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete fat JAR pipeline for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.devbuildPipeline;
                            dump(deployData);
                        }
                        if (folderData.devbuildArtifact) {
                            try {
                                progress.report({ message: `Deleting fat JAR artifact for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting fat JAR artifact for ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteDeployArtifact(provider, folderData.devbuildArtifact, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete fat JAR artifact for ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.devbuildArtifact;
                            dump(deployData);
                        }
                        if (folderData.codeRepository) {
                            try {
                                progress.report({ message: `Deleting source code repository for ${repositoryName}...` });
                                logUtils.logInfo(`[undeploy] Deleting source code repository ${deployData.compartment.name}/${projectName}/${repositoryName}`);
                                await ociUtils.deleteCodeRepository(provider, folderData.codeRepository, true);
                            } catch (err) {
                                resolve(dialogs.getErrorMessage(`Failed to delete source code repository ${repositoryName}`, err));
                                return;
                            }
                            delete folderData.codeRepository;
                            dump(deployData);
                        }
                        if (Object.keys(folderData).length === 0) {
                            delete deployData.repositories[repositoryName];
                            dump(deployData);
                        }
                    }
                    const folder = folders.find(f => removeSpaces(f.folder.name) === repositoryName);
                    if (folder) {
                        const folderPath = folder.folder.uri.fsPath;
                        const gcnPath = path.join(folderPath, '.vscode', 'gcn.json');
                        if (fs.existsSync(gcnPath)) {
                            progress.report({ message : `Deleting GCN registration ${gcnPath}` });
                            logUtils.logInfo(`[undeploy] Deleting GCN registration ${gcnPath}`);
                            fs.unlinkSync(gcnPath);
                        }
                        const gcnFolderPath = path.join(folderPath, '.gcn');
                        if (fs.existsSync(gcnFolderPath)) {
                            progress.report({ message : 'Deleting local OCI resources' });
                            logUtils.logInfo(`[undeploy] Deleting local OCI resources in ${gcnFolderPath}`);
                            fs.rmdirSync(gcnFolderPath, { recursive : true });
                        }
                    }
                }
            }
            let knowledgeBase;
            if (deployData.knowledgeBaseOCID) {
                knowledgeBase = deployData.knowledgeBaseOCID;
            } else if (deployData.knowledgeBaseWorkRequest) {
                try {
                    knowledgeBase = await ociUtils.admWaitForResourceCompletionStatus(provider, `Knowledge base for project ${projectName}`, deployData.knowledgeBaseWorkRequest);
                } catch (err) {
                    knowledgeBase = undefined;
                }
            }
            if (knowledgeBase) {
                try {
                    progress.report({ message: `Deleting ADM knowledge base for ${projectName}...` });
                    logUtils.logInfo(`[undeploy] Deleting ADM knowledge base for ${deployData.compartment.name}/${projectName}`);
                    await ociUtils.deleteKnowledgeBase(provider, knowledgeBase, true);
                } catch (err) {
                    resolve(dialogs.getErrorMessage('Failed to delete knowledge base', err));
                    return;
                }
                if (deployData.knowledgeBaseOCID) {
                    delete deployData.knowledgeBaseOCID;
                }
                if (deployData.knowledgeBaseWorkRequest) {
                    delete deployData.knowledgeBaseWorkRequest;
                }
                dump(deployData);

            }
            if (deployData.okeClusterEnvironment) {
                try {
                    progress.report({ message: `Deleting OKE cluster environment for ${projectName}...` });
                    logUtils.logInfo(`[undeploy] Deleting OKE cluster environment for ${deployData.compartment.name}/${projectName}`);
                    await ociUtils.deleteDeployEnvironment(provider, deployData.okeClusterEnvironment, true);
                } catch (err) {
                    resolve(dialogs.getErrorMessage('Failed to delete OKE cluster environment', err));
                    return;
                }
                delete deployData.okeClusterEnvironment;
                dump(deployData);
            }
            if (deployData.artifactsRepository) {
                try {
                    progress.report({ message: `Deleting artifact repository for ${projectName}...` });
                    logUtils.logInfo(`[undeploy] Deleting artifact repository for ${deployData.compartment.name}/${projectName}`);
                    await ociUtils.deleteArtifactsRepository(provider, deployData.compartment.ocid, deployData.artifactsRepository, true);
                } catch (err) {
                    resolve(dialogs.getErrorMessage('Failed to delete artifact repository', err));
                    return;
                }
                delete deployData.artifactsRepository;
                dump(deployData);
            }
            if (deployData.projectLogWorkRequest) {
                try {
                    progress.report({ message: `Deleting project log for ${projectName}...` });
                    logUtils.logInfo(`[undeploy] Deleting project log for ${deployData.compartment.name}/${projectName}`);
                    const log = await ociUtils.loggingWaitForResourceCompletionStatus(provider, `Log for project ${projectName}`, deployData.projectLogWorkRequest);
                    if (log) {
                        await ociUtils.deleteLog(provider, log, deployData.logGroup, true);
                    }
                } catch (err) {
                    resolve(dialogs.getErrorMessage('Failed to delete project log', err));
                    return;
                }
                delete deployData.projectLogWorkRequest;
                delete deployData.logGroup;
                dump(deployData);
            }
            if (deployData.project) {
                try {
                    progress.report({ message: `Deleting devops project ${projectName}...` });
                    logUtils.logInfo(`[undeploy] Deleting devops project ${deployData.compartment.name}/${projectName}`);
                    await ociUtils.deleteDevOpsProject(provider, deployData.project.ocid, true);
                } catch (err) {
                    resolve(dialogs.getErrorMessage('Failed to delete devops project', err));
                    return;
                }
            }
            delete deployData.project;
            dump();

            resolve(undefined);
        });
    });

    if (error) {
        dialogs.showErrorMessage(error);
        logUtils.logInfo(`[undeploy] Failed: ${error}`);
    } else {
        logUtils.logInfo(`[undeploy] Devops project successfully deleted`);
    }
}

export async function undeployFolders(folders: gcnServices.FolderData[]) {
    logUtils.logInfo('[undeploy] Invoked undeploy folders');

    const nblsErr = await projectUtils.checkNBLS();
    if (nblsErr) {
        dialogs.showErrorMessage(nblsErr);
        logUtils.logInfo(`[undeploy] ${nblsErr}`);
        return;
    }

    logUtils.logInfo(`[undeploy] Configured to undeploy ${folders.length} folder(s)`);
    for (const folder of folders) {
        try {
            logUtils.logInfo(`[undeploy] Undeploying folder ${folder.folder.uri.fsPath}`);
            await undeployFolder(folder);
            logUtils.logInfo(`[undeploy] Folder ${folder.folder.uri.fsPath} successfully undeployed`);
        } catch (err) {
            dialogs.showErrorMessage(`Failed to undeploy folder ${folder.folder.name}`, err);
        }
    }
}

export async function undeployFolder(folder: gcnServices.FolderData) {
    const services = ociServices.findByFolderData(folder);
    if (services.length === 0) {
        logUtils.logInfo(`[undeploy] No services to undeploy for ${folder.folder.name}`);
        return;
    }

    const oci = services[0].getContext();
    const problem = oci.getConfigurationProblem();
    if (problem) {
        dialogs.showErrorMessage(`Cannot undeploy folder ${folder.folder.name}: ${problem}`);
        return;
    }

    const authProvider = oci.getProvider();
    const devopsId = oci.getDevOpsProject();
    const compartmentId = oci.getCompartment();

    const data : [devops.models.Project, identity.models.Compartment | undefined] = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Validating OCI data for folder ${folder.folder.name}`
    }, async (_progress, _token) => {
        const p = await ociUtils.getDevopsProject(authProvider, devopsId);
        const c = await ociUtils.getCompartment(authProvider, compartmentId);
        return [p, c];
    });
    if (!data[0]) {
        dialogs.showErrorMessage(`Cannot undeploy folder ${folder.folder.name}: Failed to resolve DevOps Project ${devopsId}`);
        return;
    }
    if (!data[1]) {
        dialogs.showErrorMessage(`Cannot undeploy folder ${folder.folder.name}: Failed to resolve Compartment ${compartmentId}`);
        return;
    }

    const folderPath = folder.folder.uri.fsPath;

    const compartmentLogname = data[1].name;
    const projectLogname = `${compartmentLogname}/${data[0].name}`;
    logUtils.logInfo(`[undeploy] Folder ${folderPath} will be undeployed from ${projectLogname}`);

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Undeploying ${data[0].name} from OCI `,
        cancellable: false
    }, async (_progress, _token) => {
        _progress.report({message : "Listing project repositories"});
        const repoNames: string[] = [];
        logUtils.logInfo(`[undeploy] Listing all source code repositories in ${projectLogname}`);
        const repoPromises : Promise<any>[] | undefined = (await ociUtils.listCodeRepositories(authProvider, devopsId)).map(repo => {
            if (repo.name) {
                repoNames.push(repo.name);
            }
            _progress.report({ message: `Deleting code repository: ${repo.name}`})
            logUtils.logInfo(`[undeploy] Deleting code repository ${repo.name} in ${projectLogname}`);
            return ociUtils.deleteCodeRepository(authProvider, repo.id);
        });
        if (repoPromises) {
            logUtils.logInfo(`[undeploy] Wating to complete deletion of all code repositories in ${projectLogname}`);
            await Promise.all(repoPromises);
            logUtils.logInfo(`[undeploy] All code repositories in ${projectLogname} deleted`);
        }
        
        const gitPath = path.join(folderPath, '.git');
        if (fs.existsSync(gitPath)) {
            _progress.report({ message: `Deleting local GIT repository at ${gitPath}`})
            logUtils.logInfo(`[undeploy] Deleting local GIT repository at ${gitPath}`);
            fs.rmdirSync(gitPath, { recursive : true});
        }

        _progress.report({message : "Listing Build Pipelines"});
        logUtils.logInfo(`[undeploy] Listing all build pipelines in ${projectLogname}`);

        const buildPipelines: devops.models.BuildPipelineSummary[] = await ociUtils.listBuildPipelines(authProvider, devopsId);
        for (let pipe of buildPipelines) {
            _progress.report({message : `Processing pipeline ${pipe.displayName}`});
            logUtils.logInfo(`[undeploy] Processing build pipeline ${pipe.displayName} in ${projectLogname}`);

            logUtils.logInfo(`[undeploy] Listing stages of build pipeline ${pipe.displayName} in ${projectLogname}`);
            const stages: Array<devops.models.BuildPipelineStageSummary> = await ociUtils.listBuildPipelineStages(authProvider, pipe.id);
            const orderedStages: devops.models.BuildPipelineStageSummary[] = [];
            const id2Stage: Map<string, devops.models.BuildPipelineStageSummary> = new Map();

            // push leaf stages first.
            const revDeps: Map<string, number> = new Map();
            stages.forEach(s => {
                id2Stage.set(s.id, s);
                if (!revDeps.has(s.id)) {
                    revDeps.set(s.id, 0);
                }
                //console.log(`Stage ${s.displayName} has predecessors: ${s.buildPipelineStagePredecessorCollection?.items.map(pred => pred.id).join(', ')}`)
                for (let p of s.buildPipelineStagePredecessorCollection?.items || []) {
                    if (p.id === s.id || p.id === pipe.id) {
                        // ??? Who invented reference-to-owner in predecessors ??
                        continue;
                    }
                    let n = (revDeps.get(p.id) || 0);
                    revDeps.set(p.id, n + 1);
                }
            });

            while (revDeps.size > 0) {
                let found : boolean = false;
                for (let k of revDeps.keys()) {
                    if (revDeps.get(k) == 0) {
                        found = true;
                        const s = id2Stage.get(k);
                        revDeps.delete(k);
                        if (!s) continue;

                        orderedStages.push(s);
                        //console.log(`Add stage ${s.displayName} = ${s.id}`)
                        for (let p of s.buildPipelineStagePredecessorCollection?.items || []) {
                            if (p.id === s.id || p.id === pipe.id) {
                                continue;
                            }
                            let n = (revDeps.get(p.id) || 1);
                            revDeps.set(p.id, n - 1);
                        }
                    }
                }
                if (!found) {
                    throw "Inconsistent pipeline structure!";
                }
            }

            // console.log(`Deleting ${orderedStages.length} stages before deleting ${pipe.displayName}`);
            for (let stage of orderedStages) {
                _progress.report({message : `Deleting stage ${stage.displayName}`});
                logUtils.logInfo(`[undeploy] Deleting stage ${stage.displayName} of build pipeline ${pipe.displayName} in ${projectLogname}`);
                await ociUtils.deleteBuildPipelineStage(authProvider, stage.id, true);
            }
            _progress.report({message : `Deleting pipeline ${pipe.displayName}`});

            // in theory, pipelines are independent, but it seems the delete operation overlaps on the project OCID, so they must be deleted
            // sequentially.
            logUtils.logInfo(`[undeploy] Deleting build pipeline ${pipe.displayName} in ${projectLogname}`);
            await ociUtils.deleteBuildPipeline(authProvider, pipe.id, true)
        };

        _progress.report({message : "Listing Deploy Pipelines"});
        logUtils.logInfo(`[undeploy] Listing all deployment pipelines in ${projectLogname}`);

        const deployPipelines: devops.models.DeployPipelineSummary[] = await ociUtils.listDeployPipelines(authProvider, devopsId);
        for (let pipe of deployPipelines) {
            _progress.report({message : `Processing pipeline ${pipe.displayName}`});

            logUtils.logInfo(`[undeploy] Listing stages of deployment pipeline ${pipe.displayName} in ${projectLogname}`);
            const stages: devops.models.DeployStageSummary[] = await ociUtils.listDeployStages(authProvider, pipe.id);
            const orderedStages: devops.models.DeployStageSummary[] = [];
            const id2Stage: Map<string, devops.models.DeployStageSummary> = new Map();

            // push leaf stages first.
            const revDeps: Map<string, number> = new Map();
            stages.forEach(s => {
                id2Stage.set(s.id, s);
                if (!revDeps.has(s.id)) {
                    revDeps.set(s.id, 0);
                }
                // console.log(`Stage ${s.displayName} has predecessors: ${s.deployStagePredecessorCollection?.items.map(pred => pred.id).join(', ')}`)
                for (let p of s.deployStagePredecessorCollection?.items || []) {
                    if (p.id === s.id || p.id === pipe.id) {
                        // ??? Who invented reference-to-owner in predecessors ??
                        continue;
                    }
                    let n = (revDeps.get(p.id) || 0);
                    revDeps.set(p.id, n + 1);
                }
            });

            while (revDeps.size > 0) {
                let found : boolean = false;
                for (let k of revDeps.keys()) {
                    if (revDeps.get(k) == 0) {
                        found = true;
                        const s = id2Stage.get(k);
                        revDeps.delete(k);
                        if (!s) continue;

                        orderedStages.push(s);
                        //console.log(`Add stage ${s.displayName} = ${s.id}`)
                        for (let p of s.deployStagePredecessorCollection?.items || []) {
                            if (p.id === s.id || p.id === pipe.id) {
                                continue;
                            }
                            let n = (revDeps.get(p.id) || 1);
                            revDeps.set(p.id, n - 1);
                        }
                    }
                }
                if (!found) {
                    throw "Inconsistent pipeline structure!";
                }
            }

            // console.log(`Deleting ${orderedStages.length} stages before deleting ${pipe.displayName}`);
            for (let stage of orderedStages) {
                _progress.report({message : `Deleting stage ${stage.displayName}`});
                logUtils.logInfo(`[undeploy] Deleting stage ${stage.displayName} of deployment pipeline ${pipe.displayName} in ${projectLogname}`);
                await ociUtils.deleteDeployStage(authProvider, stage.id, true);
            }
            _progress.report({message : `Deleting pipeline ${pipe.displayName}`});

            // in theory, pipelines are independent, but it seems the delete operation overlaps on the project OCID, so they must be deleted
            // sequentially.
            logUtils.logInfo(`[undeploy] Deleting deployment pipeline ${pipe.displayName} in ${projectLogname}`);
            await ociUtils.deleteDeployPipeline(authProvider, pipe.id, true)
        };

        _progress.report({message : "Listing project logs"});
        logUtils.logInfo(`[undeploy] Listing all logs in ${projectLogname}`);
        const logPromises : Promise<any>[] | undefined = (await ociUtils.listLogsByProject(authProvider, compartmentId, devopsId))?.map(l => {
            _progress.report({message : `Deleting log ${l.displayName}`});
            logUtils.logInfo(`[undeploy] Deleting log ${l.displayName} in ${projectLogname}`);
            return ociUtils.deleteLog(authProvider, l.id, l.logGroupId, true);
        });
        if (logPromises) {
            logUtils.logInfo(`[undeploy] Wating to complete deletion of all logs in ${projectLogname}`);
            await Promise.all(logPromises);
            logUtils.logInfo(`[undeploy] All logs in ${projectLogname} deleted`);
        }
        
        _progress.report({message : "Listing deploy artifacts"});
        logUtils.logInfo(`[undeploy] Listing all deploy artifacts in ${projectLogname}`);
        let artifacts = await ociUtils.listDeployArtifacts(authProvider, devopsId);
        for (let a of artifacts) {
            _progress.report({ message: `Deleting artifact ${a.displayName}`});
            logUtils.logInfo(`[undeploy] Deleting artifact ${a.displayName} in ${projectLogname}`);
            // seems that deleteArtifact also transaction-conflicts on the project.
            await ociUtils.deleteDeployArtifact(authProvider, a.id, true);
        };
        _progress.report({ message: 'Searching artifact repositories'});
        logUtils.logInfo(`[undeploy] Listing all artifact repositories in ${compartmentLogname}`);
        const artifactsRepositories = await ociUtils.listArtifactRepositories(authProvider, compartmentId);
        if (artifactsRepositories) {
            for (const repo of artifactsRepositories) {
                if ((repo.freeformTags?.['gcn_tooling_projectOCID'] == devopsId)) {
                    _progress.report({message : `Deleting artifact repository ${repo.displayName}`});
                    logUtils.logInfo(`[undeploy] Deleting artifact repository ${repo.displayName} in ${compartmentLogname}`);
                    await ociUtils.deleteArtifactsRepository(authProvider, compartmentId, repo.id, true);
                }
            }
        }
        _progress.report({ message: 'Searching container repositories'});
        logUtils.logInfo(`[undeploy] Listing all container repositories in ${compartmentLogname}`);
        const containerRepositories = await ociUtils.listContainerRepositories(authProvider, compartmentId);
        if (containerRepositories) {
            const containerRepositoryNames: string[] = [];
            const projectFolder = await projectUtils.getProjectFolder(folder.folder);
            const cloudSubNames = projectUtils.getCloudSpecificSubProjectNames(projectFolder);
            if (repoNames.length > 1) {
                for (const name of repoNames) {
                    if (cloudSubNames.length) {
                        for (const subName of cloudSubNames) {
                            containerRepositoryNames.push(`${data[0].name}-${name}-${subName}`.toLowerCase());
                        }
                    } else {
                        containerRepositoryNames.push(`${data[0].name}-${name}`.toLowerCase());
                    }
                }
            } else {
                if (cloudSubNames.length) {
                    for (const subName of cloudSubNames) {
                        containerRepositoryNames.push(`${data[0].name}-${subName}`.toLowerCase());
                    }
                } else {
                    containerRepositoryNames.push(data[0].name.toLowerCase());
                }
            }
            for (const repo of containerRepositories) {
                if (containerRepositoryNames.includes(repo.displayName)) {
                    _progress.report({message : `Deleting container repository ${repo.displayName}`});
                    logUtils.logInfo(`[undeploy] Deleting container repository ${repo.displayName} in ${compartmentLogname}`);
                    await ociUtils.deleteContainerRepository(authProvider, repo.id, true);
                }
            }
        }
        _progress.report({ message: 'Searching OKE cluster environments'});
        logUtils.logInfo(`[undeploy] Listing all OKE cluster environments in ${projectLogname}`);
        const okeClusterEnvironments = await ociUtils.listDeployEnvironments(authProvider, devopsId);
        for (const env of okeClusterEnvironments) {
            _progress.report({message : `Deleting OKE cluster environment ${env.displayName}`});
            logUtils.logInfo(`[undeploy] Deleting OKE cluster environment ${env.displayName} in ${projectLogname}`);
            await ociUtils.deleteDeployEnvironment(authProvider, env.id, true);
        }
        // PENDING: knowledgebase search + deletion should be done by the Services Plugin; need API to invoke it on the OCI configuration.
        _progress.report({ message: 'Searching knowledge bases'});
        logUtils.logInfo(`[undeploy] Listing all knowledge bases in ${compartmentLogname}`);
        let knowledgeBases = await ociUtils.listKnowledgeBases(authProvider, compartmentId);
        for (let kb of knowledgeBases) {
            if ((kb.freeformTags?.['gcn_tooling_usage'] === "gcn-adm-audit") &&
                (kb.freeformTags?.['gcn_tooling_projectOCID'] == devopsId)) {
                    _progress.report({message : `Deleting knowledge base ${kb.displayName}`});
                    logUtils.logInfo(`[undeploy] Deleting knowledge base ${kb.displayName} in ${compartmentLogname}`);
                    await ociUtils.deleteKnowledgeBase(authProvider, kb.id, true);
            }
        }
        _progress.report({message : `Deleting project ${data[0].name}`});
        logUtils.logInfo(`[undeploy] Deleting devops project ${projectLogname}`);
        let p = ociUtils.deleteDevOpsProject(authProvider, devopsId, true);
        logUtils.logInfo(`[undeploy] Devops project ${projectLogname} deleted`);
        const gcnPath = path.join(folderPath, '.vscode', 'gcn.json');
        _progress.report({message : `Deleting GCN registration ${gcnPath}`});
        logUtils.logInfo(`[undeploy] Deleting GCN registration ${gcnPath}`);
        fs.unlinkSync(gcnPath); 
        const gcnFolderPath = path.join(folderPath, '.gcn');
        if (fs.existsSync(gcnFolderPath)) {
            _progress.report({message : 'Deleting local OCI resources'});
            logUtils.logInfo(`[undeploy] Deleting local OCI resources in ${gcnFolderPath}`);
            fs.rmdirSync(gcnFolderPath, { recursive : true});
        }

        return p;
    });
}

function removeSpaces(name: string): string {
    return name.replace(/\s+/g, '_');
}
