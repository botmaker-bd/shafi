const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class PythonRunner {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        this.initialized = false;
        this.pythonCommand = null;
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            this.pythonCommand = await this.detectPythonCommand();
            this.initialized = true;
            console.log('✅ Python runner initialized with command:', this.pythonCommand);
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error);
            this.pythonCommand = 'python'; // Fallback
            this.initialized = true;
        }
    }

    async detectPythonCommand() {
        return new Promise((resolve, reject) => {
            const commands = ['python3', 'python', 'py'];
            let currentIndex = 0;

            const tryNextCommand = () => {
                if (currentIndex >= commands.length) {
                    reject(new Error('No Python command found. Please install Python.'));
                    return;
                }

                const command = commands[currentIndex];
                console.log(`🔍 Testing Python command: ${command}`);

                const process = exec(`${command} --version`, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`❌ ${command} not found:`, error.message);
                        currentIndex++;
                        tryNextCommand();
                    } else {
                        console.log(`✅ Found Python: ${stdout.trim()}`);
                        resolve(command);
                    }
                });

                // Timeout for command detection
                setTimeout(() => {
                    process.kill();
                    console.log(`❌ ${command} timeout`);
                    currentIndex++;
                    tryNextCommand();
                }, 5000);
            };

            tryNextCommand();
        });
    }

    async runPythonCode(code, inputData = null, timeout = 60000) {
        await this.initialize();
        
        if (!this.pythonCommand) {
            throw new Error('Python is not available. Please install Python.');
        }

        return new Promise((resolve, reject) => {
            const tempFile = path.join(this.tempDir, `script_${uuidv4()}.py`);
            let processKilled = false;

            try {
                const pythonTemplate = this.createPythonTemplate(code, inputData);
                fs.writeFileSync(tempFile, pythonTemplate);
                
                console.log(`🐍 Executing Python code (${code.length} chars)`);

                const pythonProcess = spawn(this.pythonCommand, [
                    tempFile, 
                    inputData ? JSON.stringify(inputData) : ''
                ], {
                    timeout: timeout,
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                let output = '';
                let errorOutput = '';

                pythonProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                const processTimeout = setTimeout(() => {
                    processKilled = true;
                    pythonProcess.kill('SIGTERM');
                    reject(new Error('Python execution timeout (60 seconds)'));
                }, timeout);

                pythonProcess.on('close', (code) => {
                    clearTimeout(processTimeout);
                    
                    // Cleanup temp file
                    this.cleanupTempFile(tempFile);

                    if (processKilled) return;

                    if (code === 0 && output) {
                        try {
                            const result = JSON.parse(output.trim());
                            if (result.success) {
                                resolve(result.result || 'Python code executed successfully');
                            } else {
                                reject(new Error(`Python Error [${result.type}]: ${result.error}\n${result.traceback}`));
                            }
                        } catch (parseError) {
                            // If not JSON, return raw output
                            resolve(output.trim() || 'Python code executed successfully');
                        }
                    } else {
                        const errorMessage = errorOutput || 'Python execution failed with no output';
                        reject(new Error(`Python Execution Failed (code ${code}): ${errorMessage}`));
                    }
                });

                pythonProcess.on('error', (error) => {
                    clearTimeout(processTimeout);
                    this.cleanupTempFile(tempFile);
                    reject(new Error(`Python process error: ${error.message}`));
                });

            } catch (error) {
                this.cleanupTempFile(tempFile);
                reject(new Error(`Python runner setup error: ${error.message}`));
            }
        });
    }

    createPythonTemplate(code, inputData) {
        return `
import sys
import json
import math
import random
import datetime
import os
import traceback

try:
    import requests
except ImportError:
    requests = None

# Input data handling
input_data = None
if len(sys.argv) > 1 and sys.argv[1].strip():
    try:
        input_data = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        input_data = sys.argv[1]

try:
    # User code execution
    ${code}
    
    # Default result if not set
    if 'result' not in locals() and 'result' not in globals():
        result = "Code executed successfully"
        
    # Ensure result is serializable
    try:
        json.dumps(result)
        output_result = result
    except (TypeError, ValueError):
        output_result = str(result)
    
    print(json.dumps({"success": True, "result": output_result}))
    
except Exception as e:
    error_info = {
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc()
    }
    print(json.dumps({"success": False, **error_info}))
    sys.exit(1)
`;
    }

    cleanupTempFile(tempFile) {
        try {
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        } catch (error) {
            console.error('❌ Temp file cleanup error:', error);
        }
    }

    async installPythonLibrary(libraryName) {
        await this.initialize();
        
        if (!this.pythonCommand) {
            throw new Error('Python is not available');
        }

        return new Promise((resolve, reject) => {
            if (!libraryName || typeof libraryName !== 'string') {
                reject(new Error('Invalid library name'));
                return;
            }

            console.log(`📦 Installing Python library: ${libraryName}`);
            
            const pipCommand = this.pythonCommand === 'py' ? 'py -m pip' : `${this.pythonCommand} -m pip`;
            const installProcess = exec(`${pipCommand} install ${libraryName}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Failed to install ${libraryName}:`, error);
                    reject(new Error(`Failed to install ${libraryName}: ${error.message}`));
                } else {
                    console.log(`✅ Successfully installed ${libraryName}`);
                    resolve({
                        library: libraryName,
                        output: stdout,
                        installed: true
                    });
                }
            });

            // Timeout for installation
            setTimeout(() => {
                installProcess.kill();
                reject(new Error(`Installation timeout for ${libraryName}`));
            }, 120000); // 2 minutes timeout
        });
    }
}

const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;