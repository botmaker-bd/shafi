// server/core/python-runner.js - OPTIMIZED VERSION
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
        this.pythonCommand = this.findPythonCommand();
    }

    findPythonCommand() {
        const commands = ['python3', 'python'];
        for (const cmd of commands) {
            try {
                const result = spawnSync(cmd, ['--version'], { encoding: 'utf-8' });
                if (result.status === 0) return cmd;
            } catch (error) {
                continue;
            }
        }
        throw new Error('Python is not installed or not in PATH');
    }

    async initialize() {
        if (this.initialized) return;
        try {
            await this.checkPython();
            this.initialized = true;
        } catch (error) {
            throw new Error(`Python runner initialization failed: ${error.message}`);
        }
    }

    async checkPython() {
        return new Promise((resolve, reject) => {
            try {
                const result = spawnSync(this.pythonCommand, ['--version'], { 
                    encoding: 'utf-8',
                    timeout: 5000 
                });
                result.status === 0 ? resolve() : reject(new Error('Python check failed'));
            } catch (error) {
                reject(new Error(`Python check failed: ${error.message}`));
            }
        });
    }

    runPythonCodeSync(code) {
        try {
            // Trim and validate code
            const trimmedCode = code.trim();
            if (!trimmedCode) throw new Error('Python code cannot be empty');

            // Choose execution method based on code complexity
            return this.isSimpleExpression(trimmedCode) 
                ? this.runSimpleExpression(trimmedCode)
                : this.runPythonFile(trimmedCode);
            
        } catch (error) {
            throw new Error(`Python Error: ${error.message}`);
        }
    }

    isSimpleExpression(code) {
        // Simple mathematical expressions without newlines
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        return simplePattern.test(code) && !code.includes('\n');
    }

    runSimpleExpression(expression) {
        try {
            const result = spawnSync(this.pythonCommand, ['-c', `print(${expression})`], {
                timeout: 10000,
                encoding: 'utf-8'
            });

            if (result.error) throw new Error(`Python process error: ${result.error.message}`);
            if (result.status !== 0) throw new Error(this.getErrorOutput(result));

            return result.stdout ? result.stdout.trim() : 'No output';

        } catch (error) {
            throw error;
        }
    }

    runPythonFile(code) {
        let tempFile;
        try {
            tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            const pythonTemplate = this.generatePythonTemplate(code);
            fs.writeFileSync(tempFile, pythonTemplate);
            
            const result = spawnSync(this.pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir
            });

            // Clean up temp file
            this.cleanupFile(tempFile);

            if (result.error) throw new Error(`Python process error: ${result.error.message}`);
            if (result.status !== 0) throw new Error(this.getErrorOutput(result));

            return result.stdout ? result.stdout.trim() : 'Code executed successfully';

        } catch (error) {
            // Ensure cleanup even on error
            if (tempFile) this.cleanupFile(tempFile);
            throw error;
        }
    }

    generatePythonTemplate(code) {
        return `# Python Code Execution
import sys

try:
    # User's code
${this.indentCode(code)}
    
    # Success indicator if no explicit output
    if 'result' not in locals() and 'result' not in globals():
        print("✅ Python code executed successfully")
    
except Exception as e:
    print(f"❌ Python Error: {str(e)}")
    sys.exit(1)`;
    }

    indentCode(code) {
        return code.split('\n')
            .map(line => line.trim() === '' ? '' : '    ' + line)
            .join('\n');
    }

    getErrorOutput(result) {
        const errorOutput = result.stderr || result.stdout;
        if (!errorOutput) return 'Python execution failed';
        
        // Extract first meaningful error line
        const errorLines = errorOutput.split('\n')
            .filter(line => line.trim() && !line.includes('File "<string>"'));
        return errorLines[0] || 'Unknown Python error';
    }

    cleanupFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (error) {
            // Silent cleanup failure
        }
    }

    // Async compatibility
    async runPythonCode(code) {
        return this.runPythonCodeSync(code);
    }

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

    // Utility method to check if library is installed
    async isLibraryInstalled(libraryName) {
        const libraries = await this.getInstalledLibraries();
        return libraries.includes(libraryName);
    }

    // Method to uninstall library
    async uninstallPythonLibrary(libraryName) {
        await this.initialize();
        try {
            const pipCommand = process.env.PIP_PATH || 'pip3';
            const result = spawnSync(pipCommand, ['uninstall', '-y', libraryName], {
                encoding: 'utf-8',
                timeout: 60000
            });
            
            if (result.status === 0) {
                await this.removeInstalledLibrary(libraryName);
                return { 
                    library: libraryName, 
                    uninstalled: true,
                    output: result.stdout 
                };
            } else {
                throw new Error(result.stderr || 'Uninstallation failed');
            }
        } catch (error) {
            throw new Error(`Failed to uninstall ${libraryName}: ${error.message}`);
        }
    }

    async removeInstalledLibrary(libraryName) {
        try {
            const libraries = await this.getInstalledLibraries();
            const updatedLibraries = libraries.filter(lib => lib !== libraryName);
            
            await supabase.from('universal_data').upsert({
                data_type: 'system',
                data_key: 'python_libraries',
                data_value: JSON.stringify(updatedLibraries),
                metadata: { 
                    last_updated: new Date().toISOString(),
                    total_libraries: updatedLibraries.length
                },
                updated_at: new Date().toISOString()
            }, { onConflict: 'data_type,data_key' });
        } catch (error) {
            console.error('❌ Remove library error:', error);
        }
    }
}

// Create singleton instance
const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;