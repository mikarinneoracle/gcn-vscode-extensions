/*
 * Copyright (c) 2022, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

import * as vscode from 'vscode';
import * as model from '../model';
import * as nodes from '../nodes';
import * as ociSupport from './ociSupport';
import * as ociContext from './ociContext';

export class ServicePlugin {

    private serviceType: string;

    constructor(serviceType: string) {
        this.serviceType = serviceType;
    }

    initialize(_folder: vscode.WorkspaceFolder, _data : any, _dataChanged : ociSupport.DataChanged) : any {
        return undefined;
    }

    getServiceType() {
        return this.serviceType;
    }

    buildInline(_oci: ociContext.Context, _services: any, _treeChanged: nodes.TreeChanged): nodes.BaseNode[] | undefined {
        return undefined;
    }

    buildContainers(_oci: ociContext.Context, _services: any, _treeChanged: nodes.TreeChanged): nodes.BaseNode[] | undefined {
        return undefined;
    }

    importServices(_oci: ociContext.Context): Promise<any | undefined> {
        return Promise.resolve(undefined);
    }

}

export class OciServices implements model.CloudServices {

    private readonly oci: ociContext.Context;
    private readonly data: any;
    private readonly dataChanged: ociSupport.DataChanged;

    constructor(oci: ociContext.Context, folder : vscode.WorkspaceFolder, data: any, dataChanged: ociSupport.DataChanged) {
        this.oci = oci;
        this.data = data;
        this.dataChanged = dataChanged;

    
        let saveData : boolean = false;
        for (const featurePlugin of ociSupport.SERVICE_PLUGINS) {
            const featureData = this.data.services?.[featurePlugin.getServiceType()]?.settings || {};

            const createdData : any = featurePlugin.initialize(folder, featureData, () => {
                this.data.services[featurePlugin.getServiceType()].settings = createdData;
                this.dataChanged();
            }) || featureData;

            if (createdData != featureData) {
                this.data.services[featurePlugin.getServiceType()].settings = createdData;
                saveData = true;
            }
        }
        if (saveData) {
            dataChanged();
        }
    }

    buildNodes(treeChanged: nodes.TreeChanged): nodes.BaseNode[] {
        const serviceNodes: nodes.BaseNode[] = [];

        const ociConfigProblem = this.oci.getConfigurationProblem();
        if (ociConfigProblem) {
            serviceNodes.push(new nodes.TextNode(`<${ociConfigProblem}>`));
        } else {
            for (const featurePlugin of ociSupport.SERVICE_PLUGINS) {
                const featureServices = this.data.services?.[featurePlugin.getServiceType()];
                if (featureServices) {
                    const inline = featurePlugin.buildInline(this.oci, featureServices, treeChanged);
                    if (inline) {
                        serviceNodes.push(...inline);
                    }
                }
            }
            for (const featurePlugin of ociSupport.SERVICE_PLUGINS) {
                const featureServices = this.data.services?.[featurePlugin.getServiceType()];
                if (featureServices) {
                    const containers = featurePlugin.buildContainers(this.oci, featureServices, treeChanged);
                    if (containers) {
                        serviceNodes.push(...containers);
                    }
                }
            }
        }

        return serviceNodes;
    }

}
