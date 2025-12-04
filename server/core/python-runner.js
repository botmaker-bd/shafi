// server/core/python-runner.js - FINAL FIX
const { spawn, spawnSync } = require('child_process');
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
            // Check Python availability
            const pythonExists = spawnSync('python3', ['--version'], {
                encoding: 'utf-8',
                timeout: 5000
            });
            
            if (pythonExists.status === 0) {
                console.log('🐍 Python3 found:', pythonExists.stdout.trim());
            } else {
                console.warn('⚠️ Python3 not found, trying python...');
                const python2 = spawnSync('python', ['--version'], {
                    encoding: 'utf-8',
                    timeout: 5000
                });
                if (python2.status === 0) {
                    console.log('🐍 Python found:', python2.stdout.trim());
                } else {
                    console.error('❌ Python not found');
                }
            }
            
            this.initialized = true;
            console.log('✅ Python runner initialized successfully');
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error);
            this.initialized = true; // Initialize anyway
        }
    }

    // ✅ SIMPLE & RELIABLE Python execution
    async runPythonCode(code) {
        console.log('🐍 Running Python code...');
        
        // If code doesn't end with print statement, add it
        const trimmedCode = code.trim();
        if (!trimmedCode.includes('print(') && !trimmedCode.includes('return')) {
            code = `${code}\nprint("SUCCESS: Code executed")`;
        }
        
        return new Promise((resolve, reject) => {
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // Simple Python file
            const pythonTemplate = `# Python Code
import sys
import traceback

try:
${this.indentCode(code, 4)}
    sys.exit(0)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {str(e)}")
    print(f"TRACEBACK: {traceback.format_exc()}")
    sys.exit(1)`;

            fs.writeFileSync(tempFile, pythonTemplate);
            
            const pythonProcess = spawn('python3', [tempFile], {
                cwd: this.tempDir,
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 30000
            });

            let stdoutData = '';
            let stderrData = '';

            pythonProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            pythonProcess.on('close', (code) => {
                // Cleanup
                try {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }

                if (code !== 0) {
                    const errorMsg = stderrData || stdoutData || 'Python execution failed';
                    console.error('❌ Python process error:', errorMsg);
                    reject(new Error(errorMsg));
                    return;
                }

                // Success
                const output = stdoutData.trim();
                console.log('✅ Python output:', output);
                resolve(output || 'Code executed successfully');
            });

            pythonProcess.on('error', (err) => {
                try {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }
                reject(new Error(`Python process failed to start: ${err.message}`));
            });

            // Timeout
            setTimeout(() => {
                if (pythonProcess.exitCode === null) {
                    pythonProcess.kill('SIGTERM');
                    try {
                        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                    } catch (cleanupError) {
                        console.error('❌ Temp file cleanup error:', cleanupError);
                    }
                    reject(new Error('Python execution timeout (30 seconds)'));
                }
            }, 30000);
        });
    }

    // ✅ SYNC VERSION
    runPythonCodeSync(code) {
        console.log('🐍 Running Python code synchronously');
        
        // If code doesn't end with print statement, add it
        const trimmedCode = code.trim();
        if (!trimmedCode.includes('print(') && !trimmedCode.includes('return')) {
            code = `${code}\nprint("SUCCESS: Code executed")`;
        }
        
        try {
            const tempFile = path.join(this.tempDir, `script_sync_${Date.now()}.py`);
            
            const pythonTemplate = `# Python Code
import sys
import traceback

try:
${this.indentCode(code, 4)}
    sys.exit(0)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {str(e)}")
    print(f"TRACEBACK: {traceback.format_exc()}")
    sys.exit(1)`;

            fs.writeFileSync(tempFile, pythonTemplate);
            
            const result = spawnSync('python3', [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Cleanup
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
                const errorMsg = result.stderr || result.stdout || 'Python execution failed';
                throw new Error(errorMsg.split('\n')[0]);
            }

            const output = result.stdout ? result.stdout.trim() : 'No output';
            console.log('✅ Python sync output:', output);
            return output;

        } catch (error) {
            console.error('❌ Python file execution error:', error);
            throw error;
        }
    }

    indentCode(code, spaces = 4) {
        const lines = code.split('\n');
        const indentedLines = lines.map(line => {
            if (line.trim() === '') return '';
            return ' '.repeat(spaces) + line;
        });
        return indentedLines.join('\n');
    }

    // ✅ SIMPLE Python test method
    async testPython() {
        try {
            const result = await this.runPythonCode(`
print("Python Test")
print("Version check:")
import sys
print(f"Python {sys.version}")
print("Basic math: 2 + 3 =", 2 + 3)
print("✅ Python is working!")
            `);
            
            return {
                success: true,
                output: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;