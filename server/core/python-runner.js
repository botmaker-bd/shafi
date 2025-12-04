// server/core/python-runner.js - ULTIMATE FIX
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PythonRunner {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        this.requirementsFile = path.join(__dirname, '../../requirements.txt');
        
        // Create temp directory if doesn't exist
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        
        // Create requirements.txt if doesn't exist
        if (!fs.existsSync(this.requirementsFile)) {
            this.createDefaultRequirements();
        }
        
        this.initialized = false;
        this.pythonPath = null;
        this.pipPath = null;
        
        console.log('🐍 Python Runner Initialized');
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            // Detect Python path
            this.pythonPath = await this.detectPython();
            
            if (!this.pythonPath) {
                console.warn('⚠️ Python not found, using python3 as default');
                this.pythonPath = 'python3';
            }
            
            // Detect pip path
            this.pipPath = await this.detectPip();
            
            console.log(`✅ Python: ${this.pythonPath}`);
            console.log(`✅ Pip: ${this.pipPath || 'Not found'}`);
            
            // Try to install requirements in background
            this.installRequirementsBackground();
            
            this.initialized = true;
            console.log('✅ Python runner initialized successfully');
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error.message);
            this.initialized = true; // Mark as initialized anyway
        }
    }

    async detectPython() {
        const commands = ['python3', 'python', 'py'];
        
        for (const cmd of commands) {
            try {
                const result = spawnSync(cmd, ['--version'], {
                    encoding: 'utf-8',
                    timeout: 5000
                });
                
                if (result.status === 0) {
                    console.log(`🐍 Found: ${cmd} - ${result.stdout.trim()}`);
                    return cmd;
                }
            } catch (error) {
                continue;
            }
        }
        
        return null;
    }

    async detectPip() {
        const pipCommands = ['pip3', 'pip'];
        
        for (const cmd of pipCommands) {
            try {
                const result = spawnSync(cmd, ['--version'], {
                    encoding: 'utf-8',
                    timeout: 5000
                });
                
                if (result.status === 0) {
                    console.log(`📦 Found: ${cmd}`);
                    return cmd;
                }
            } catch (error) {
                continue;
            }
        }
        
        // Try python -m pip
        try {
            const result = spawnSync(this.pythonPath, ['-m', 'pip', '--version'], {
                encoding: 'utf-8',
                timeout: 5000
            });
            
            if (result.status === 0) {
                console.log('📦 Found: pip via python -m pip');
                return `${this.pythonPath} -m pip`;
            }
        } catch (error) {
            // Ignore
        }
        
        return null;
    }

    createDefaultRequirements() {
        const defaultContent = `# Python requirements for Telegram Bot Platform
requests==2.31.0
beautifulsoup4==4.12.2
python-dotenv==1.0.0
aiohttp==3.8.5

# Optional - can be installed later via /install command
# pandas==2.1.1
# numpy==1.24.3
# telethon==1.28.5
# Pillow==10.0.1`;
        
        fs.writeFileSync(this.requirementsFile, defaultContent);
        console.log('📄 Created default requirements.txt');
    }

    async installRequirementsBackground() {
        // Run in background without blocking
        setTimeout(async () => {
            if (!this.pipPath) {
                console.log('⚠️ Skipping requirements installation - pip not found');
                return;
            }
            
            try {
                console.log('📦 Installing Python requirements in background...');
                
                let installArgs;
                if (this.pipPath.includes(' -m ')) {
                    const parts = this.pipPath.split(' ');
                    installArgs = [parts[0], '-m', 'pip', 'install', '-r', this.requirementsFile];
                } else {
                    installArgs = [this.pipPath, 'install', '-r', this.requirementsFile];
                }
                
                // Add --break-system-packages for Render.com
                installArgs.push('--break-system-packages');
                installArgs.push('--quiet');
                installArgs.push('--no-warn-script-location');
                
                const installProcess = spawn(installArgs[0], installArgs.slice(1), {
                    cwd: path.dirname(this.requirementsFile),
                    stdio: 'ignore',
                    timeout: 180000 // 3 minutes
                });
                
                installProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log('✅ Python requirements installed successfully');
                    } else {
                        console.log('⚠️ Requirements installation may have partially failed');
                    }
                });
                
                installProcess.on('error', (error) => {
                    console.log('⚠️ Background installation error:', error.message);
                });
                
            } catch (error) {
                console.log('⚠️ Background installation failed:', error.message);
            }
        }, 5000); // Wait 5 seconds before starting
    }

    // ✅ SMART Python execution with auto-print
    async runPythonCode(code) {
        console.log('🐍 Running Python code...');
        
        // Ensure code ends with print/return
        const trimmedCode = code.trim();
        let finalCode = code;
        
        if (!trimmedCode.includes('print(') && !trimmedCode.includes('return')) {
            finalCode = `${code}\nprint("SUCCESS: Code executed successfully")`;
        }
        
        return new Promise((resolve, reject) => {
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // Smart Python template
            const pythonTemplate = `import sys
import traceback
import json

def execute_user_code():
${this.indentCode(finalCode, 4)}

try:
    # Execute user code
    result = execute_user_code()
    
    # If function returned something, print it
    if result is not None:
        if isinstance(result, (dict, list, tuple, set)):
            print(json.dumps({"type": "data", "data": result}))
        else:
            print(str(result))
    else:
        # Code executed but returned nothing
        print("Code executed successfully")
        
except Exception as e:
    # Format error for Telegram
    error_info = {
        "type": "error",
        "error": str(e),
        "error_type": type(e).__name__
    }
    print(json.dumps(error_info))
    sys.exit(1)`;

            fs.writeFileSync(tempFile, pythonTemplate);
            
            const pythonProcess = spawn(this.pythonPath, [tempFile], {
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

                const output = stdoutData.trim();
                const errorOutput = stderrData.trim();

                if (code !== 0) {
                    // Try to parse JSON error
                    try {
                        const errorJson = JSON.parse(output);
                        if (errorJson.type === 'error') {
                            reject(new Error(`${errorJson.error_type}: ${errorJson.error}`));
                            return;
                        }
                    } catch (e) {
                        // Not JSON, use raw error
                        const errorMsg = errorOutput || output || 'Python execution failed';
                        reject(new Error(errorMsg.split('\n')[0]));
                        return;
                    }
                }

                // Success - try to parse JSON output
                try {
                    const resultJson = JSON.parse(output);
                    if (resultJson.type === 'data') {
                        resolve(resultJson.data);
                        return;
                    }
                } catch (e) {
                    // Not JSON, return raw output
                }

                // Return clean output
                const cleanOutput = output.replace(/^{.*}$/gm, '').trim();
                resolve(cleanOutput || 'Code executed successfully');
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
        
        // Ensure code ends with print/return
        const trimmedCode = code.trim();
        let finalCode = code;
        
        if (!trimmedCode.includes('print(') && !trimmedCode.includes('return')) {
            finalCode = `${code}\nprint("SUCCESS: Code executed successfully")`;
        }
        
        try {
            const tempFile = path.join(this.tempDir, `script_sync_${Date.now()}.py`);
            
            const pythonTemplate = `import sys
import traceback
import json

def execute_user_code():
${this.indentCode(finalCode, 4)}

try:
    # Execute user code
    result = execute_user_code()
    
    # If function returned something, print it
    if result is not None:
        if isinstance(result, (dict, list, tuple, set)):
            print(json.dumps({"type": "data", "data": result}))
        else:
            print(str(result))
    else:
        # Code executed but returned nothing
        print("Code executed successfully")
        
except Exception as e:
    # Format error for Telegram
    error_info = {
        "type": "error",
        "error": str(e),
        "error_type": type(e).__name__
    }
    print(json.dumps(error_info))
    sys.exit(1)`;

            fs.writeFileSync(tempFile, pythonTemplate);
            
            const result = spawnSync(this.pythonPath, [tempFile], {
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

            const output = result.stdout ? result.stdout.trim() : '';
            const errorOutput = result.stderr ? result.stderr.trim() : '';

            if (result.status !== 0) {
                // Try to parse JSON error
                try {
                    const errorJson = JSON.parse(output);
                    if (errorJson.type === 'error') {
                        throw new Error(`${errorJson.error_type}: ${errorJson.error}`);
                    }
                } catch (e) {
                    // Not JSON, use raw error
                    const errorMsg = errorOutput || output || 'Python execution failed';
                    throw new Error(errorMsg.split('\n')[0]);
                }
            }

            // Try to parse JSON output
            try {
                const resultJson = JSON.parse(output);
                if (resultJson.type === 'data') {
                    return resultJson.data;
                }
            } catch (e) {
                // Not JSON, return raw output
            }

            // Return clean output
            const cleanOutput = output.replace(/^{.*}$/gm, '').trim();
            return cleanOutput || 'Code executed successfully';

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

    // ✅ Python test method
    async testPython() {
        try {
            const result = await this.runPythonCode(`
import sys
print("🐍 Python Test")
print("=" * 30)
print(f"Python Version: {sys.version}")
print(f"Python Path: {sys.executable}")
print(f"2 + 3 = {2 + 3}")

# Test JSON
import json
data = {"test": "success", "number": 42}
print(f"JSON Test: {json.dumps(data)}")

return "✅ Python is working perfectly!"
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

    // ✅ Install Python package
    async installPackage(packageName) {
        return new Promise((resolve, reject) => {
            console.log(`📦 Installing: ${packageName}`);
            
            let installArgs;
            
            if (this.pipPath.includes(' -m ')) {
                const parts = this.pipPath.split(' ');
                installArgs = [parts[0], '-m', 'pip', 'install', packageName];
            } else {
                installArgs = [this.pipPath, 'install', packageName];
            }
            
            // Add flags for Render.com
            installArgs.push('--break-system-packages');
            installArgs.push('--quiet');
            installArgs.push('--no-warn-script-location');
            
            const installProcess = spawn(installArgs[0], installArgs.slice(1), {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 120000
            });

            let stdoutData = '';
            let stderrData = '';

            installProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            installProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            installProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Installed: ${packageName}`);
                    resolve({
                        success: true,
                        package: packageName,
                        output: stdoutData
                    });
                } else {
                    const errorMsg = stderrData || `Failed to install ${packageName}`;
                    console.error(`❌ Install failed: ${errorMsg}`);
                    reject(new Error(errorMsg));
                }
            });

            installProcess.on('error', (err) => {
                reject(new Error(`Pip process failed: ${err.message}`));
            });
        });
    }
}

const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;