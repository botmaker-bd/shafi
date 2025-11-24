// server/core/python-runner.js - IMPROVED ERROR HANDLING
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
        this.initializationPromise = null;
        this.pythonCommand = null;
    }

    async initialize() {
        // Prevent multiple simultaneous initializations
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = (async () => {
            if (this.initialized) return true;

            try {
                this.pythonCommand = await this.findPythonCommand();
                await this.checkPython();
                this.initialized = true;
                return true;
            } catch (error) {
                this.initialized = false;
                throw new Error(`Python runner initialization failed: ${error.message}`);
            }
        })();

        return this.initializationPromise;
    }

    async findPythonCommand() {
        const commands = ['python3', 'python'];
        
        for (const cmd of commands) {
            try {
                const result = spawnSync(cmd, ['--version'], { 
                    encoding: 'utf-8',
                    timeout: 5000 
                });
                if (result.status === 0) {
                    console.log(`✅ Found Python: ${cmd}`);
                    return cmd;
                }
            } catch (error) {
                continue;
            }
        }
        throw new Error('No Python installation found. Please install Python 3.6+');
    }

    async checkPython() {
        return new Promise((resolve, reject) => {
            try {
                const result = spawnSync(this.pythonCommand, ['-c', 'import sys; print(f"Python {sys.version}")'], { 
                    encoding: 'utf-8',
                    timeout: 10000 
                });
                
                if (result.status === 0) {
                    console.log(`🐍 Python Check: ${result.stdout.trim()}`);
                    resolve();
                } else {
                    reject(new Error(`Python check failed: ${result.stderr || 'Unknown error'}`));
                }
            } catch (error) {
                reject(new Error(`Python check failed: ${error.message}`));
            }
        });
    }

    async runPythonCodeSync(code) {
        // Ensure initialization
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const trimmedCode = code.trim();
            if (!trimmedCode) throw new Error('Python code cannot be empty');

            return this.isSimpleExpression(trimmedCode) 
                ? await this.runSimpleExpression(trimmedCode)
                : await this.runPythonFile(trimmedCode);
            
        } catch (error) {
            throw new Error(`Python Execution Error: ${error.message}`);
        }
    }

    isSimpleExpression(code) {
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        return simplePattern.test(code) && !code.includes('\n');
    }

    async runSimpleExpression(expression) {
        try {
            const result = spawnSync(this.pythonCommand, ['-c', `print(${expression})`], {
                timeout: 15000,
                encoding: 'utf-8'
            });

            if (result.error) throw new Error(`Process error: ${result.error.message}`);
            if (result.status !== 0) throw new Error(this.getErrorOutput(result));

            return result.stdout ? result.stdout.trim() : 'No output';

        } catch (error) {
            throw new Error(`Simple expression failed: ${error.message}`);
        }
    }

    async runPythonFile(code) {
        let tempFile;
        try {
            tempFile = path.join(this.tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
            
            const pythonTemplate = this.generatePythonTemplate(code);
            fs.writeFileSync(tempFile, pythonTemplate);
            
            const result = spawnSync(this.pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir
            });

            this.cleanupFile(tempFile);

            if (result.error) throw new Error(`Process error: ${result.error.message}`);
            if (result.status !== 0) throw new Error(this.getErrorOutput(result));

            return result.stdout ? result.stdout.trim() : 'Code executed successfully';

        } catch (error) {
            if (tempFile) this.cleanupFile(tempFile);
            throw new Error(`Python file execution failed: ${error.message}`);
        }
    }

    generatePythonTemplate(code) {
        return `# Python Code Execution
import sys
import traceback

try:
    # User's code
${this.indentCode(code)}
    
    # Success indicator if no explicit output
    if 'result' not in locals() and 'result' not in globals():
        print("✅ Python code executed successfully")
    
except Exception as e:
    print(f"❌ Python Error: {str(e)}")
    traceback.print_exc()
    sys.exit(1)`;
    }

    indentCode(code) {
        return code.split('\n')
            .map(line => line.trim() === '' ? '' : '    ' + line)
            .join('\n');
    }

    getErrorOutput(result) {
        const errorOutput = result.stderr || result.stdout;
        if (!errorOutput) return 'Python execution failed with no output';
        
        // Extract first meaningful error line
        const errorLines = errorOutput.split('\n')
            .filter(line => line.trim() && 
                   !line.includes('File "<string>"') &&
                   !line.includes('sys.exit'))
            .map(line => line.trim());
        
        return errorLines[0] || 'Unknown Python execution error';
    }

    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            // Silent cleanup - don't throw errors during cleanup
        }
    }

    // Async compatibility
    async runPythonCode(code) {
        return this.runPythonCodeSync(code);
    }

    // Health check method
    async healthCheck() {
        try {
            await this.initialize();
            const result = await this.runPythonCodeSync('2 + 2');
            return {
                healthy: true,
                pythonCommand: this.pythonCommand,
                testResult: result,
                initialized: this.initialized
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                initialized: this.initialized
            };
        }
    }

    // Rest of the methods remain the same...
    async installPythonLibrary(libraryName) {
        await this.initialize();
        try {
            const pipCommand = process.env.PIP_PATH || 'pip3';
            const result = spawnSync(pipCommand, ['install', libraryName], {
                encoding: 'utf-8',
                timeout: 120000
            });
            
            if (result.status === 0) {
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
            if (currentData?.data_value) {
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

            return data?.data_value ? JSON.parse(data.data_value) : [];
        } catch (error) {
            return [];
        }
    }
}

// Create singleton instance with better error handling
const pythonRunnerInstance = new PythonRunner();

// Initialize on startup with error recovery
pythonRunnerInstance.initialize().catch(error => {
    console.error('⚠️ Python runner initialization warning:', error.message);
});

module.exports = pythonRunnerInstance;