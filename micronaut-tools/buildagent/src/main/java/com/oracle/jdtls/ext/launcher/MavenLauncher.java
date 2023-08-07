/*
 * Copyright (c) 2023, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl.
 */

package com.oracle.jdtls.ext.launcher;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Map;

/**
 *
 * @author sdedic
 */
public class MavenLauncher extends LauncherDelegate {
    
    private static final String ORACLE_RUN_GOAL = "ORACLE_RUN_GOAL";
    
    protected String execGoal = "org.codehaus.mojo:exec-maven-plugin:3.1.0:exec";
    
    private ProcessBuilder processBuilder;
    
    public LauncherDelegate configureLauncher() {
        String sprop = getSystemProperties().remove(ORACLE_RUN_GOAL);
        String env = env(ORACLE_RUN_GOAL, null);
        if (env != null) {
            execGoal = env;
        } else if (sprop != null) {
            execGoal = sprop;
        }
        return this;
    }
    
    protected void addMainClassParam() {
    }
    
    protected void constructMavenExecArgs() {
        
    }
    
    ProcessBuilder createProcessBuilder() {
        Path exec = getOSExecutable(getProjectDirectory(), "mvnw");
        if (exec == null && getProjectRootDirectory() != null) {
            exec = getOSExecutable(getProjectRootDirectory(), "mvnw");
        }
        if (exec == null) {
            String m2home = System.getenv("MAVEN_HOME");
            if (m2home != null) {
                exec = getOSExecutable(Paths.get(m2home), "mvn");
            }
            if (exec == null) {
                exec = findExecutableOnPath("mvn");
            }
        }
        
        processBuilder = new ProcessBuilder();
        processBuilder.directory(getProjectDirectory().toFile());
        // maven executable
        addCommand(exec.toAbsolutePath().toString());
        
        Map<String, String> e = filterEnvironment();
        processBuilder.environment().keySet().retainAll(e.keySet());
        processBuilder.environment().putAll(e);
        return processBuilder;
    }
    
    void configureMavenProperties() {
        addCommand("-Dexec.executable=" + getJvmBinaryPath());
        
        // exec.args --------------
        configureVMArgs();
        
        addQuotedPart("${exec.mainClass}");

        // App args:
        for (String s : getProgramArgs()) {
            addQuotedPart(s);
        }
        
        addCommand("-Dexec.args=" + parts());
        // ------- end exec.args

        // main class
        if (getMainClass() != null) {
            addCommand("-Dexec.mainClass=" + getMainClass());
        }
        
        if (getCwd() != null) {
            // micronaut BUG: mn:run does not support working directory settings.
            addCommand("-Dexec.workingdir=" + getCwd());
        }
    }
    
    void configureVMArgs() {
        // JVM args:
        for (String s : getVmArgs()) {
            addQuotedPart(s);
        }
        // add classpath
        addQuotedPart("--class-path"); addQuotedPart("%classpath");
        
        // debug mode
        if (isDebugMode()) {
            addQuotedPart(getJdwpParam());
        }
        
        if (isUsesModules()) {
            addQuotedPart("--module-path");
            addQuotedPart("%modulepath");
        }
        if (getMainClass() != null) {
            if (isUsesModules()) {
                addQuotedPart("--module");
            }
        }
    }
    
    protected void addProjectProperties() {
        // additonal maven properties
        for (String s : getProjectProperties().keySet()) {
            addCommand("-D" + s + "=" + getProjectProperties().get(s));
        }
    }
    
    ProcessBuilder configureProcessBuilder() {
        ProcessBuilder pb = createProcessBuilder();
        configureMavenProperties();

        // TODO allow the user to configure an exec goal though System Properties or env variables.
        addCommand(execGoal);
        
        pb.command(commands()).inheritIO();
        
        System.err.println("Running: " + Arrays.asList(pb.command()));
        return pb;
    }
    
    @Override
    public int execute() throws InterruptedException, IOException {
        Process p = configureProcessBuilder().start();
        Runtime.getRuntime().addShutdownHook(new Thread() {
            @Override
            public void run() {
                ProcessesImpl.killTree(p);
            }
        });
        return p.waitFor();
    }
    
}
