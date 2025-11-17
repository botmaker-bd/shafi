// server/core/python-runner.js - UPDATED VERSION
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

class PythonRunner {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        this.initialized = false;
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.checkPython();
            this.initialized = true;
            console.log('✅ Python runner initialized successfully');
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error);
        }
    }

    async checkPython() {
        return new Promise((resolve, reject) => {
            exec('python3 --version', (error, stdout, stderr) => {
                if (error) {
                    exec('python --version', (error2, stdout2, stderr2) => {
                        if (error2) {
                            reject(new Error('Python is not installed or not in PATH'));
                        } else {
                            console.log(`🐍 Python found: ${stdout2.trim()}`);
                            resolve();
                        }
                    });
                } else {
                    console.log(`🐍 Python3 found: ${stdout.trim()}`);
                    resolve();
                }
            });
        });
    }

    // ✅ NEW: Synchronous-style Python execution
    runPythonCodeSync(code, inputData = null) {
        return new Promise((resolve, reject) => {
            try {
                const tempFile = path.join(this.tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
                
                // ✅ SIMPLIFIED PYTHON TEMPLATE
                const pythonTemplate = `# Python Code Execution
import sys
import json

try:
    # User's code execution
    ${code}
    
    # If no result variable exists, create one
    if 'result' not in locals() and 'result' not in globals():
        result = "Python code executed successfully"
    
    # Return the result
    output_data = {"success": True, "result": result}
    
except Exception as e:
    import traceback
    output_data = {
        "success": False, 
        "error": str(e),
        "traceback": traceback.format_exc()
    }

# Always print JSON output
print(json.dumps(output_data))`;

                fs.writeFileSync(tempFile, pythonTemplate);
                
                const pythonCommand = process.env.PYTHON_PATH || 'python3';
                const pythonProcess = spawn(pythonCommand, [tempFile], {
                    timeout: 30000
                });

                let output = '';
                let errorOutput = '';

                pythonProcess.stdout.on('data', (data) => {
                    output += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    errorOutput += data.toString();
                });

                pythonProcess.on('close', (code) => {
                    // Clean up
                    try {
                        if (fs.existsSync(tempFile)) {
                            fs.unlinkSync(tempFile);
                        }
                    } catch (cleanupError) {
                        console.error('❌ Temp file cleanup error:', cleanupError);
                    }

                    if (code === 0 && output) {
                        try {
                            const result = JSON.parse(output);
                            if (result.success) {
                                resolve(result.result);
                            } else {
                                reject(new Error(result.error));
                            }
                        } catch (parseError) {
                            resolve(output.trim());
                        }
                    } else {
                        reject(new Error(errorOutput || 'Python execution failed'));
                    }
                });

                pythonProcess.on('error', (error) => {
                    reject(new Error(`Python process error: ${error.message}`));
                });

            } catch (error) {
                reject(new Error(`Python setup error: ${error.message}`));
            }
        });
    }

    // ✅ Keep the original async method for compatibility
    async runPythonCode(code, inputData = null) {
        return this.runPythonCodeSync(code, inputData);
    }

    // Other methods remain the same...
    async installPythonLibrary(libraryName) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            console.log(`📦 Installing Python library: ${libraryName}`);
            const pipCommand = process.env.PIP_PATH || 'pip3';
            exec(`${pipCommand} install ${libraryName}`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to install ${libraryName}: ${error.message}`));
                } else {
                    this.saveInstalledLibrary(libraryName).catch(console.error);
                    resolve({ library: libraryName, output: stdout, installed: true });
                }
            });
        });
    }

    async saveInstalledLibrary(libraryName) {
        try {
            const { data: currentData } = await supabase
                .from('universal_data')
                .select('data_value')
                .eq('data_type', 'system')
                .eq('data_key', 'python_libraries')
                .single();

            let libraries = [];
            if (currentData && currentData.data_value) {
                try {
                    libraries = JSON.parse(currentData.data_value);
                } catch (e) {
                    libraries = [];
                }
            }

            if (!libraries.includes(libraryName)) {
                libraries.push(libraryName);
                await supabase.from('universal_data').upsert({
                    data_type: 'system',
                    data_key: 'python_libraries',
                    data_value: JSON.stringify(libraries),
                    metadata: { last_updated: new Date().toISOString() },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'data_type,data_key' });
            }
        } catch (error) {
            console.error('❌ Save library error:', error);
        }
    }

    async getInstalledLibraries() {
        try {
            const { data } = await supabase
                .from('universal_data')
                .select('data_value')
                .eq('data_type', 'system')
                .eq('data_key', 'python_libraries')
                .single();

            return data && data.data_value ? JSON.parse(data.data_value) : [];
        } catch (error) {
            return [];
        }
    }

    async uninstallPythonLibrary(libraryName) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            const pipCommand = process.env.PIP_PATH || 'pip3';
            exec(`${pipCommand} uninstall -y ${libraryName}`, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Failed to uninstall ${libraryName}: ${error.message}`));
                } else {
                    resolve({ library: libraryName, output: stdout, uninstalled: true });
                }
            });
        });
    }
}

const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;