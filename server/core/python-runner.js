// server/core/python-runner.js - RESULT FORMATTING FIX
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

    // ✅ FIXED: PROPER RESULT EXTRACTION
    runPythonCodeSync(code) {
        try {
            console.log('🐍 Executing Python code synchronously...');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(7)}.py`);
            
            // ✅ CLEANER PYTHON TEMPLATE
            const pythonTemplate = `# Python Code Execution
import sys
import json

try:
    # User's code execution
${this.indentCode(code)}
    
    # Ensure result variable exists and is properly formatted
    if 'result' not in locals() and 'result' not in globals():
        result = "Python code executed successfully"
    
    # ✅ FIX: Return ONLY the result value, not JSON
    print(str(result))
    
except Exception as e:
    # ✅ FIX: Return clean error message
    print("Python Error: " + str(e))
    sys.exit(1)`;

            // Write Python file
            fs.writeFileSync(tempFile, pythonTemplate);
            
            // Determine Python command
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            
            // Use spawnSync for synchronous execution
            const result = spawnSync(pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8'
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
                throw new Error(`Python process error: ${result.error.message}`);
            }

            // Check exit code
            if (result.status !== 0) {
                throw new Error(`Python execution failed: ${result.stderr || result.stdout || 'Unknown error'}`);
            }

            // ✅ FIX: Return clean output
            if (result.stdout) {
                const output = result.stdout.trim();
                console.log('✅ Python output:', output);
                return output;
            } else {
                throw new Error('Python execution produced no output');
            }

        } catch (error) {
            console.error('❌ Python execution error:', error);
            throw new Error(`Python execution failed: ${error.message}`);
        }
    }

    // ✅ PROPER INDENTATION METHOD
    indentCode(code) {
        const lines = code.split('\n');
        const indentedLines = lines.map(line => {
            if (line.trim() === '') return line;
            return '    ' + line;
        });
        return indentedLines.join('\n');
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
}

// Create singleton instance
const pythonRunnerInstance = new PythonRunner();

module.exports = pythonRunnerInstance;