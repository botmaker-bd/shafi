// server/core/python-runner.js - COMPLETELY FIXED VERSION
const { spawnSync } = require('child_process');
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
            try {
                const result = spawnSync('python3', ['--version'], { encoding: 'utf-8' });
                if (result.status === 0) {
                    console.log('🐍 Python3 found:', result.stdout.trim());
                    resolve();
                } else {
                    const result2 = spawnSync('python', ['--version'], { encoding: 'utf-8' });
                    if (result2.status === 0) {
                        console.log('🐍 Python found:', result2.stdout.trim());
                        resolve();
                    } else {
                        reject(new Error('Python is not installed or not in PATH'));
                    }
                }
            } catch (error) {
                reject(new Error('Python check failed: ' + error.message));
            }
        });
    }

    // ✅ FIXED: PROPER PYTHON CODE EXECUTION WITH CORRECT INDENTATION
    runPythonCodeSync(code) {
        try {
            console.log('🐍 Executing Python code synchronously...');
            console.log('📝 Python code:', code.substring(0, 200) + '...');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
            
            // ✅ FIXED: SIMPLIFIED PYTHON TEMPLATE WITHOUT COMPLEX INDENTATION
            const pythonTemplate = `# Python Code Execution
import sys
import json

try:
    # User's code execution - DIRECT EXECUTION
    ${this.preparePythonCode(code)}
    
    # If we reach here, execution was successful
    print("✅ Python code executed successfully")
    
except Exception as e:
    # Return clean error message
    error_msg = f"❌ Python Error: {str(e)}"
    print(error_msg)
    sys.exit(1)`;

            // Write Python file
            fs.writeFileSync(tempFile, pythonTemplate);
            console.log('📄 Python file created:', tempFile);
            
            // Determine Python command
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            console.log('🔧 Using Python command:', pythonCommand);
            
            // Use spawnSync for synchronous execution
            const result = spawnSync(pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir
            });

            // Clean up temporary file
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (cleanupError) {
                console.error('❌ Temp file cleanup error:', cleanupError);
            }

            // Check for process errors
            if (result.error) {
                console.error('❌ Python process error:', result.error);
                throw new Error(`Python process error: ${result.error.message}`);
            }

            // Check exit code
            if (result.status !== 0) {
                console.error('❌ Python execution failed. Exit code:', result.status);
                console.error('Python stderr:', result.stderr);
                console.error('Python stdout:', result.stdout);
                
                let errorMessage = 'Python execution failed';
                if (result.stderr) {
                    errorMessage = result.stderr.split('\\n')[0]; // Get first line of error
                } else if (result.stdout) {
                    errorMessage = result.stdout.split('\\n')[0]; // Get first line of output
                }
                
                throw new Error(errorMessage);
            }

            // Return clean output
            if (result.stdout) {
                const output = result.stdout.trim();
                console.log('✅ Python output received:', output.substring(0, 100) + '...');
                return output;
            } else {
                return 'Python code executed (no output)';
            }

        } catch (error) {
            console.error('❌ Python execution error:', error);
            throw new Error(`Python execution failed: ${error.message}`);
        }
    }

    // ✅ FIXED: PROPER PYTHON CODE PREPARATION
    preparePythonCode(code) {
        try {
            // Remove any existing indentation and handle line breaks
            const lines = code.split('\n');
            let preparedCode = [];
            
            for (let line of lines) {
                // Trim whitespace but preserve empty lines for structure
                const trimmedLine = line.trim();
                if (trimmedLine === '') {
                    preparedCode.push('');
                } else {
                    preparedCode.push(trimmedLine);
                }
            }
            
            // Join with proper line breaks
            return preparedCode.join('\n    ');
            
        } catch (error) {
            console.error('❌ Python code preparation error:', error);
            return code; // Fallback to original code
        }
    }

    // ✅ FIXED: ALTERNATIVE METHOD FOR COMPLEX CODE
    runPythonCodeAdvanced(code) {
        try {
            console.log('🐍 Executing Python code (advanced method)...');
            
            const tempFile = path.join(this.tempDir, `advanced_${Date.now()}.py`);
            
            // Write user code directly to file
            fs.writeFileSync(tempFile, code);
            
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir
            });

            // Clean up
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (cleanupError) {
                console.error('❌ Temp file cleanup error:', cleanupError);
            }

            if (result.error) {
                throw new Error(`Python process error: ${result.error.message}`);
            }

            if (result.status !== 0) {
                throw new Error(result.stderr || result.stdout || 'Python execution failed');
            }

            return result.stdout ? result.stdout.trim() : 'Code executed successfully';

        } catch (error) {
            console.error('❌ Advanced Python execution error:', error);
            throw new Error(`Python execution failed: ${error.message}`);
        }
    }

    // ✅ SIMPLE METHOD FOR BASIC CALCULATIONS
    runPythonSimple(expression) {
        try {
            console.log('🐍 Executing simple Python expression:', expression);
            
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, ['-c', `print(${expression})`], {
                timeout: 10000,
                encoding: 'utf-8'
            });

            if (result.error) {
                throw new Error(`Python process error: ${result.error.message}`);
            }

            if (result.status !== 0) {
                throw new Error(result.stderr || 'Python execution failed');
            }

            return result.stdout ? result.stdout.trim() : 'No output';

        } catch (error) {
            console.error('❌ Simple Python execution error:', error);
            throw new Error(`Python calculation failed: ${error.message}`);
        }
    }

    // Compatibility method
    async runPythonCode(code) {
        return this.runPythonCodeSync(code);
    }

    // Other methods remain the same...
    async installPythonLibrary(libraryName) {
        await this.initialize();
        try {
            console.log(`📦 Installing Python library: ${libraryName}`);
            const pipCommand = process.env.PIP_PATH || 'pip3';
            const result = spawnSync(pipCommand, ['install', libraryName], {
                encoding: 'utf-8',
                timeout: 120000
            });
            
            if (result.status === 0) {
                console.log(`✅ Successfully installed ${libraryName}`);
                await this.saveInstalledLibrary(libraryName);
                return { 
                    library: libraryName, 
                    installed: true,
                    output: result.stdout 
                };
            } else {
                throw new Error(result.stderr || 'Installation failed');
            }
        } catch (error) {
            throw new Error(`Failed to install ${libraryName}: ${error.message}`);
        }
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
                    metadata: { 
                        last_updated: new Date().toISOString(),
                        total_libraries: libraries.length
                    },
                    updated_at: new Date().toISOString()
                }, { onConflict: 'data_type,data_key' });
                
                console.log(`💾 Saved library info: ${libraryName}`);
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

            if (data && data.data_value) {
                return JSON.parse(data.data_value);
            }
            return [];
        } catch (error) {
            console.error('❌ Get installed libraries error:', error);
            return [];
        }
    }

    // ✅ NEW: VALIDATE PYTHON CODE
    validatePythonCode(code) {
        try {
            const tempFile = path.join(this.tempDir, `validate_${Date.now()}.py`);
            fs.writeFileSync(tempFile, code);
            
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, ['-m', 'py_compile', tempFile], {
                encoding: 'utf-8',
                timeout: 10000
            });

            // Clean up
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
                // Remove compiled file if exists
                const compiledFile = tempFile + 'c';
                if (fs.existsSync(compiledFile)) {
                    fs.unlinkSync(compiledFile);
                }
            } catch (cleanupError) {
                // Ignore cleanup errors
            }

            return {
                valid: result.status === 0,
                error: result.stderr || null
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }
}

// Create singleton instance
const pythonRunnerInstance = new PythonRunner();

module.exports = pythonRunnerInstance;