// server/core/python-runner.js - COMPLETELY FIXED
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
        this.pythonPath = null;
        this.pipPath = null;
        this.requirementsFile = path.join(__dirname, '../../requirements.txt');
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.checkPython();
            await this.checkPip();
            this.initialized = true;
            console.log('✅ Python runner initialized successfully');
            
            // Try to install requirements in background (non-blocking)
            this.installRequirementsSilently();
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error);
            this.initialized = true; // Mark as initialized anyway
        }
    }

    async checkPython() {
        return new Promise((resolve, reject) => {
            try {
                // Try python3 first
                let pythonCommand = 'python3';
                let result = spawnSync(pythonCommand, ['--version'], { 
                    encoding: 'utf-8',
                    timeout: 5000 
                });
                
                if (result.status === 0) {
                    this.pythonPath = pythonCommand;
                    console.log('🐍 Python3 found:', result.stdout.trim());
                    resolve();
                    return;
                }
                
                // Try python
                pythonCommand = 'python';
                result = spawnSync(pythonCommand, ['--version'], { 
                    encoding: 'utf-8',
                    timeout: 5000 
                });
                
                if (result.status === 0) {
                    this.pythonPath = pythonCommand;
                    console.log('🐍 Python found:', result.stdout.trim());
                    resolve();
                    return;
                }
                
                reject(new Error('Python is not installed or not in PATH'));
            } catch (error) {
                reject(new Error('Python check failed: ' + error.message));
            }
        });
    }

    async checkPip() {
        return new Promise((resolve, reject) => {
            try {
                // Try pip3 first
                let pipCommand = 'pip3';
                let result = spawnSync(pipCommand, ['--version'], {
                    encoding: 'utf-8',
                    timeout: 5000
                });
                
                if (result.status === 0) {
                    this.pipPath = pipCommand;
                    console.log('📦 Pip3 found');
                    resolve();
                    return;
                }
                
                // Try pip
                pipCommand = 'pip';
                result = spawnSync(pipCommand, ['--version'], {
                    encoding: 'utf-8',
                    timeout: 5000
                });
                
                if (result.status === 0) {
                    this.pipPath = pipCommand;
                    console.log('📦 Pip found');
                    resolve();
                    return;
                }
                
                resolve(); // Don't fail if pip not found
            } catch (error) {
                resolve(); // Don't fail if pip check fails
            }
        });
    }

    async installRequirementsSilently() {
        if (!fs.existsSync(this.requirementsFile)) {
            console.log('📄 requirements.txt not found, skipping');
            return;
        }
        
        // Install in background without blocking
        setTimeout(async () => {
            try {
                console.log('📦 Installing Python requirements in background...');
                
                const installProcess = spawn(this.pipPath || 'pip3', [
                    'install', '-r', this.requirementsFile,
                    '--break-system-packages',
                    '--quiet',
                    '--disable-pip-version-check'
                ], {
                    cwd: path.dirname(this.requirementsFile),
                    stdio: ['ignore', 'pipe', 'pipe'],
                    timeout: 300000
                });

                installProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log('✅ Python requirements installed successfully');
                    } else {
                        console.log('⚠️ Python requirements installation may have failed');
                    }
                });
            } catch (error) {
                console.log('⚠️ Background installation failed:', error.message);
            }
        }, 3000); // Wait 3 seconds before starting
    }

    // ✅ FIXED: runPythonCode মেথড - JSON ইস্যু ফিক্স
    async runPythonCode(code) {
        return new Promise((resolve, reject) => {
            console.log('🐍 Running Python code...');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // 🔥 CRITICAL FIX: Clean Python template
            const pythonTemplate = `# Python Code Execution
import sys
import json
import traceback

def main():
    try:
${this.indentCode(code, 8)}
        
        # If code doesn't return anything, return success
        return {"success": True, "output": "Code executed successfully"}
    except Exception as e:
        return {
            "success": False, 
            "error": str(e), 
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

# Clear any previous prints
sys.stdout.flush()

# Run main and print ONLY JSON
result = main()
print(json.dumps(result))
sys.stdout.flush()`;

            // Write to temp file
            fs.writeFileSync(tempFile, pythonTemplate);
            console.log(`📄 Created temp Python file: ${tempFile}`);

            const pythonCommand = this.pythonPath || process.env.PYTHON_PATH || 'python3';
            
            // Use spawn for async execution
            const pythonProcess = spawn(pythonCommand, [tempFile], {
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
                        console.log(`🧹 Cleaned up temp file: ${tempFile}`);
                    }
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }

                if (code !== 0) {
                    console.error(`❌ Python process exited with code ${code}`);
                    reject(new Error(stderrData || 'Python execution failed'));
                    return;
                }

                // 🔥 CRITICAL FIX: Handle output properly
                try {
                    // Find JSON in output (might have extra lines)
                    const lines = stdoutData.trim().split('\n');
                    let jsonOutput = '';
                    
                    for (const line of lines) {
                        if (line.startsWith('{') && line.endsWith('}')) {
                            jsonOutput = line;
                            break;
                        }
                    }
                    
                    if (!jsonOutput && lines.length > 0) {
                        // Try last line
                        const lastLine = lines[lines.length - 1];
                        if (lastLine.startsWith('{') && lastLine.endsWith('}')) {
                            jsonOutput = lastLine;
                        }
                    }
                    
                    if (jsonOutput) {
                        const result = JSON.parse(jsonOutput);
                        if (result.success) {
                            // If output is JSON string, parse it
                            if (result.output && typeof result.output === 'string') {
                                try {
                                    const parsedOutput = JSON.parse(result.output);
                                    resolve(parsedOutput);
                                } catch (e) {
                                    resolve(result.output);
                                }
                            } else {
                                resolve(result.output || 'Code executed successfully');
                            }
                        } else {
                            reject(new Error(`Python Error: ${result.error}`));
                        }
                    } else {
                        // No JSON found, return raw output
                        resolve(stdoutData.trim() || 'Code executed (no output)');
                    }
                } catch (parseError) {
                    console.error('❌ JSON parse error:', parseError.message);
                    console.error('Raw output:', stdoutData);
                    // If can't parse as JSON, return raw output
                    resolve(stdoutData.trim() || 'Code executed (no output)');
                }
            });

            pythonProcess.on('error', (err) => {
                console.error('❌ Python process error:', err);
                try {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }
                reject(new Error(`Python process failed to start: ${err.message}`));
            });

            // Handle timeout
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

    // ✅ FIXED: SYNC VERSION
    runPythonCodeSync(code) {
        try {
            console.log('🐍 Running Python code synchronously');
            
            // Check if it's a simple expression
            if (this.isSimpleExpression(code)) {
                return this.runSimpleExpressionSync(code);
            }
            
            // For multi-line code
            return this.runPythonFileSync(code);
            
        } catch (error) {
            console.error('❌ runPythonCodeSync error:', error);
            throw error;
        }
    }

    // ✅ CHECK IF SIMPLE EXPRESSION
    isSimpleExpression(code) {
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        const trimmed = code.trim();
        return simplePattern.test(trimmed) && 
               !trimmed.includes('\n') && 
               !trimmed.includes('import') && 
               !trimmed.includes('def ') &&
               !trimmed.includes('print(');
    }

    // ✅ RUN SIMPLE EXPRESSION SYNC
    runSimpleExpressionSync(expression) {
        try {
            console.log('🔧 Running simple expression:', expression);
            
            const pythonCommand = this.pythonPath || process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, ['-c', `print(${expression})`], {
                timeout: 10000,
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe']
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

    // ✅ RUN PYTHON FILE SYNC
    runPythonFileSync(code) {
        try {
            const tempFile = path.join(this.tempDir, `script_sync_${Date.now()}.py`);
            
            // Python template for sync execution
            const pythonTemplate = `# Python Code Execution
import sys
import json
import traceback

def main():
    try:
${this.indentCode(code, 8)}
        # If code doesn't return anything, return success
        return {"success": True, "output": "Code executed successfully"}
    except Exception as e:
        return {
            "success": False, 
            "error": str(e), 
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

# Clear any previous prints
sys.stdout.flush()

# Run main and print ONLY JSON
result = main()
print(json.dumps(result))
sys.stdout.flush()`;

            // Write Python file
            fs.writeFileSync(tempFile, pythonTemplate);
            console.log('📄 Python sync file created:', tempFile);
            
            // Execute Python
            const pythonCommand = this.pythonPath || process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Clean up
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                    console.log('🧹 Cleaned up sync temp file');
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
                throw new Error(errorMsg.split('\n')[0]);
            }

            // 🔥 CRITICAL FIX: Handle output properly
            const stdout = result.stdout ? result.stdout.trim() : '';
            if (stdout) {
                try {
                    // Find JSON in output
                    const lines = stdout.split('\n');
                    let jsonOutput = '';
                    
                    for (const line of lines) {
                        if (line.startsWith('{') && line.endsWith('}')) {
                            jsonOutput = line;
                            break;
                        }
                    }
                    
                    if (jsonOutput) {
                        const parsed = JSON.parse(jsonOutput);
                        if (parsed.success) {
                            return parsed.output || 'Code executed successfully';
                        } else {
                            throw new Error(`Python Error: ${parsed.error}`);
                        }
                    } else {
                        // No JSON found, return raw output
                        return stdout || 'Code executed (no output)';
                    }
                } catch (parseError) {
                    // Not JSON, return raw output
                    return stdout || 'Code executed (no output)';
                }
            }

            return 'Code executed (no output)';

        } catch (error) {
            console.error('❌ Python file execution error:', error);
            throw error;
        }
    }

    // ✅ PROPER INDENTATION HELPER
    indentCode(code, spaces = 4) {
        const lines = code.split('\n');
        const indentedLines = lines.map(line => {
            if (line.trim() === '') return '';
            return ' '.repeat(spaces) + line;
        });
        return indentedLines.join('\n');
    }

    // ✅ COMPATIBILITY METHOD (alias)
    async runPythonCodeAsync(code) {
        return await this.runPythonCode(code);
    }

    // ✅ SMART Python execution - automatically handles user code
    async runSmartPython(code) {
        try {
            console.log('🤖 Running smart Python code...');
            
            // Wrap user code to ensure proper JSON output
            const wrappedCode = `
import sys
import json

# Capture stdout to prevent extra prints
class OutputCatcher:
    def __init__(self):
        self.data = []
    
    def write(self, text):
        if text.strip():
            self.data.append(text)
    
    def flush(self):
        pass

# Redirect stdout
old_stdout = sys.stdout
catcher = OutputCatcher()
sys.stdout = catcher

try:
    # User code
${this.indentCode(code, 4)}
    
    # Get any printed output
    printed_output = "".join(catcher.data).strip()
    
    # Restore stdout
    sys.stdout = old_stdout
    
    # Return result
    if printed_output:
        print(json.dumps({"success": True, "output": printed_output}))
    else:
        print(json.dumps({"success": True, "output": "Code executed successfully"}))
        
except Exception as e:
    # Restore stdout on error
    sys.stdout = old_stdout
    print(json.dumps({
        "success": False, 
        "error": str(e), 
        "type": type(e).__name__
    }))
`;
            
            return await this.runPythonCode(wrappedCode);
            
        } catch (error) {
            console.error('❌ Smart Python execution error:', error);
            throw error;
        }
    }

    // ✅ INSTALL PYTHON LIBRARY
    async installPythonLibrary(libraryName) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            console.log(`📦 Installing Python library: ${libraryName}`);
            
            const pipCommand = this.pipPath || 'pip3';
            const pipProcess = spawn(pipCommand, [
                'install', libraryName,
                '--break-system-packages',
                '--quiet'
            ], {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 120000
            });

            let stdoutData = '';
            let stderrData = '';

            pipProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            pipProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            pipProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Successfully installed ${libraryName}`);
                    resolve({ 
                        library: libraryName, 
                        installed: true,
                        output: stdoutData 
                    });
                } else {
                    reject(new Error(stderrData || `Failed to install ${libraryName}`));
                }
            });

            pipProcess.on('error', (err) => {
                reject(new Error(`Pip process failed: ${err.message}`));
            });
        });
    }

    // ✅ Get Python info
    async getPythonInfo() {
        try {
            const versionResult = spawnSync(this.pythonPath, ['--version'], {
                encoding: 'utf-8',
                timeout: 5000
            });

            const sysResult = spawnSync(this.pythonPath, ['-c', `
import sys
import json
import os

info = {
    "version": sys.version,
    "executable": sys.executable,
    "platform": sys.platform,
    "python_path": os.environ.get('PYTHON_PATH', 'Not set'),
    "venv": "VIRTUAL_ENV" in os.environ
}

print(json.dumps(info))
            `], {
                encoding: 'utf-8',
                timeout: 10000
            });

            return {
                version: versionResult.stdout ? versionResult.stdout.trim() : 'Unknown',
                systemInfo: sysResult.stdout ? JSON.parse(sysResult.stdout) : {}
            };
        } catch (error) {
            return { error: error.message };
        }
    }
}

// Create singleton instance
const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;