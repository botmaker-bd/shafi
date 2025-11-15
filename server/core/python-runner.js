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
            // Check if Python is available
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
                    // Try python command as fallback
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

    async runPythonCode(code, inputData = null) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            try {
                const tempFile = path.join(this.tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
                
                // Enhanced Python template with common libraries and better error handling
                const pythonTemplate = `
import sys
import json
import math
import random
import datetime
import os
import traceback

# Try to import common libraries
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

# User code execution
try:
    # User's code will be inserted here
    ${code}
    
    # If no result variable, check for output
    if 'result' not in locals() and 'result' not in globals():
        result = "Code executed successfully"
        
except Exception as e:
    error_info = {
        "error": str(e),
        "type": type(e).__name__,
        "traceback": traceback.format_exc()
    }
    print(json.dumps({"success": False, **error_info}))
    sys.exit(1)
else:
    # Convert result to JSON-serializable format
    import json
    try:
        json.dumps(result)
        output_result = result
    except:
        output_result = str(result)
    
    print(json.dumps({"success": True, "result": output_result}))
`;

                fs.writeFileSync(tempFile, pythonTemplate);
                
                const pythonCommand = process.env.PYTHON_PATH || 'python3';
                const pythonProcess = spawn(pythonCommand, [
                    tempFile, 
                    inputData ? JSON.stringify(inputData) : ''
                ], {
                    timeout: 60000 // 60 seconds timeout
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
                    // Clean up temporary file
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
                                resolve(result.result || 'Python code executed successfully');
                            } else {
                                reject(new Error(`Python Error [${result.type}]: ${result.error}\n${result.traceback}`));
                            }
                        } catch (parseError) {
                            // If output is not JSON, return it as string
                            resolve(output.trim() || 'Python code executed successfully');
                        }
                    } else {
                        const errorMessage = errorOutput || 'Python execution failed with no output';
                        reject(new Error(`Python Execution Failed (code ${code}): ${errorMessage}`));
                    }
                });

                // Handle process errors
                pythonProcess.on('error', (error) => {
                    reject(new Error(`Python process error: ${error.message}`));
                });

                // Timeout protection
                const timeout = setTimeout(() => {
                    pythonProcess.kill();
                    reject(new Error('Python execution timeout (60 seconds)'));
                }, 60000);

                pythonProcess.on('close', () => {
                    clearTimeout(timeout);
                });

            } catch (error) {
                reject(new Error(`Python runner setup error: ${error.message}`));
            }
        });
    }

    async installPythonLibrary(libraryName) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            if (!libraryName || typeof libraryName !== 'string') {
                reject(new Error('Invalid library name'));
                return;
            }

            console.log(`📦 Installing Python library: ${libraryName}`);
            
            const pipCommand = process.env.PIP_PATH || 'pip3';
            exec(`${pipCommand} install ${libraryName}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Failed to install ${libraryName}:`, error);
                    reject(new Error(`Failed to install ${libraryName}: ${error.message}`));
                } else {
                    console.log(`✅ Successfully installed ${libraryName}`);
                    
                    // Save installed library info to database
                    this.saveInstalledLibrary(libraryName).catch(e => {
                        console.error('❌ Failed to save library info:', e);
                    });
                    
                    resolve({
                        library: libraryName,
                        output: stdout,
                        installed: true
                    });
                }
            });
        });
    }

    async saveInstalledLibrary(libraryName) {
        try {
            // Get current installed libraries
            const { data: currentData, error: fetchError } = await supabase
                .from('universal_data')
                .select('data_value')
                .eq('data_type', 'system')
                .eq('data_key', 'python_libraries')
                .single();

            let libraries = [];
            if (!fetchError && currentData && currentData.data_value) {
                try {
                    libraries = JSON.parse(currentData.data_value);
                if (!Array.isArray(libraries)) {
                    libraries = [];
                }
                } catch (e) {
                    libraries = [];
                }
            }

            // Add new library if not exists
            if (!libraries.includes(libraryName)) {
                libraries.push(libraryName);
                
                const { error: updateError } = await supabase
                    .from('universal_data')
                    .upsert({
                        data_type: 'system',
                        data_key: 'python_libraries',
                        data_value: JSON.stringify(libraries),
                        metadata: { 
                            last_updated: new Date().toISOString(),
                            total_libraries: libraries.length,
                            auto_managed: true
                        },
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'data_type,data_key'
                    });

                if (updateError) {
                    throw updateError;
                }
                
                console.log(`💾 Saved library info: ${libraryName}`);
            }
        } catch (error) {
            console.error('❌ Save installed library error:', error);
            throw error;
        }
    }

    async getInstalledLibraries() {
        try {
            const { data, error } = await supabase
                .from('universal_data')
                .select('data_value, metadata')
                .eq('data_type', 'system')
                .eq('data_key', 'python_libraries')
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    return [];
                }
                throw error;
            }

            if (data && data.data_value) {
                try {
                    return JSON.parse(data.data_value);
                } catch {
                    return [];
                }
            }
            return [];
        } catch (error) {
            console.error('❌ Get installed libraries error:', error);
            return [];
        }
    }

    async uninstallPythonLibrary(libraryName) {
        await this.initialize();
        
        return new Promise((resolve, reject) => {
            console.log(`🗑️ Uninstalling Python library: ${libraryName}`);
            
            const pipCommand = process.env.PIP_PATH || 'pip3';
            exec(`${pipCommand} uninstall -y ${libraryName}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Failed to uninstall ${libraryName}:`, error);
                    reject(new Error(`Failed to uninstall ${libraryName}: ${error.message}`));
                } else {
                    console.log(`✅ Successfully uninstalled ${libraryName}`);
                    resolve({
                        library: libraryName,
                        output: stdout,
                        uninstalled: true
                    });
                }
            });
        });
    }
}

// Create singleton instance
const pythonRunnerInstance = new PythonRunner();

module.exports = pythonRunnerInstance;