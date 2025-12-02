// server/core/python-runner.js - COMPLETELY FIXED
const { spawn } = require('child_process'); // spawnSync এর বদলে spawn
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
                const result = spawn('python3', ['--version'], { encoding: 'utf-8' });
                if (result.status === 0) {
                    console.log('🐍 Python3 found:', result.stdout.trim());
                    resolve();
                } else {
                    const result2 = spawn('python', ['--version'], { encoding: 'utf-8' });
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

    // ✅ FIXED: PROPER PYTHON CODE EXECUTION
    // server/core/python-runner.js এর runPythonCode মেথডটি রিপ্লেস করুন

// ... (class এর ভেতরে)

    runPythonCode(code) {
        return new Promise((resolve, reject) => {
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // টেমপ্লেট তৈরি
            const pythonTemplate = `# Python Code Execution
import sys
try:
${this.indentCode(code)}
except Exception as e:
    print(f"❌ Python Error: {str(e)}")
    sys.exit(1)`;

            fs.writeFileSync(tempFile, pythonTemplate);

            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            
            // Async spawn ব্যবহার
            const pythonProcess = spawn(pythonCommand, [tempFile], {
                cwd: this.tempDir
            });

            let outputData = '';
            let errorData = '';

            pythonProcess.stdout.on('data', (data) => {
                outputData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorData += data.toString();
            });

            pythonProcess.on('close', (code) => {
                // ক্লিনআপ
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

                if (code !== 0) {
                    reject(new Error(errorData || outputData || 'Unknown Python Error'));
                } else {
                    resolve(outputData.trim());
                }
            });

            pythonProcess.on('error', (err) => {
                if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                reject(err);
            });
        });
    }

    // ✅ CHECK IF SIMPLE EXPRESSION
    isSimpleExpression(code) {
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        return simplePattern.test(code.trim()) && !code.includes('\n');
    }

    // ✅ RUN SIMPLE EXPRESSION
    runSimpleExpression(expression) {
        try {
            console.log('🔧 Running simple expression:', expression);
            
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const result = spawn(pythonCommand, ['-c', `print(${expression})`], {
                timeout: 10000,
                encoding: 'utf-8'
            });

            if (result.error) {
                throw new Error(`Python process error: ${result.error.message}`);
            }

            if (result.status !== 0) {
                throw new Error(result.stderr || 'Python execution failed');
            }

            const output = result.stdout ? result.stdout.trim() : 'No output';
            console.log('✅ Simple expression result:', output);
            return output;

        } catch (error) {
            console.error('❌ Simple expression error:', error);
            throw error;
        }
    }

    // ✅ RUN PYTHON FILE FOR MULTI-LINE CODE
    runPythonFile(code) {
        try {
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // ✅ FIXED: CLEAN PYTHON TEMPLATE
            const pythonTemplate = `# Python Code Execution
import sys

try:
    # User's code
${this.indentCode(code)}
    
except Exception as e:
    print(f"❌ Python Error: {str(e)}")
    sys.exit(1)`;

            // Write Python file
            fs.writeFileSync(tempFile, pythonTemplate);
            console.log('📄 Python file created');
            
            // Execute Python
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const result = spawn(pythonCommand, [tempFile], {
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

            // Check for errors
            if (result.error) {
                throw new Error(`Python process error: ${result.error.message}`);
            }

            if (result.status !== 0) {
                const errorMsg = result.stderr || result.stdout || 'Python execution failed';
                throw new Error(errorMsg.split('\n')[0]); // Get first error line
            }

            const output = result.stdout ? result.stdout.trim() : 'Code executed (no output)';
            console.log('✅ Python output:', output);
            return output;

        } catch (error) {
            console.error('❌ Python file execution error:', error);
            throw error;
        }
    }

    // ✅ FIXED: PROPER INDENTATION
    indentCode(code) {
        const lines = code.split('\n');
        const indentedLines = lines.map(line => {
            if (line.trim() === '') return '';
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
            const result = spawn(pipCommand, ['install', libraryName], {
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