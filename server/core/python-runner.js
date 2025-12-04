// server/core/python-runner.js - Virtual Environment সহ
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

class PythonRunner {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        this.venvDir = path.join(__dirname, '../../venv');
        this.requirementsFile = path.join(__dirname, '../../requirements.txt');
        
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        
        this.initialized = false;
        this.pythonPath = null;
        this.pipPath = null;
        this.usingVirtualEnv = false;
        this.installedModules = new Set();
        
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.setupVirtualEnvironment();
            await this.checkRequirements();
            await this.installRequirements();
            
            this.initialized = true;
            console.log('✅ Python runner initialized with virtual environment');
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error);
            // Fallback to system Python with --break-system-packages
            await this.initializeWithSystemPython();
        }
    }

    async setupVirtualEnvironment() {
        return new Promise((resolve, reject) => {
            console.log('🐍 Setting up Python virtual environment...');
            
            // Check if venv already exists
            if (fs.existsSync(this.venvDir)) {
                console.log('✅ Virtual environment already exists');
                
                // Set paths for existing venv
                if (process.platform === 'win32') {
                    this.pythonPath = path.join(this.venvDir, 'Scripts', 'python.exe');
                    this.pipPath = path.join(this.venvDir, 'Scripts', 'pip.exe');
                } else {
                    this.pythonPath = path.join(this.venvDir, 'bin', 'python');
                    this.pipPath = path.join(this.venvDir, 'bin', 'pip');
                }
                
                this.usingVirtualEnv = true;
                resolve();
                return;
            }
            
            // Create virtual environment
            const pythonCmd = process.env.PYTHON_PATH || 'python3';
            console.log(`Creating venv with: ${pythonCmd}`);
            
            const venvProcess = spawn(pythonCmd, ['-m', 'venv', this.venvDir], {
                cwd: path.dirname(this.venvDir),
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 60000
            });

            let stdoutData = '';
            let stderrData = '';

            venvProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            venvProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            venvProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Virtual environment created successfully');
                    
                    // Set paths based on OS
                    if (process.platform === 'win32') {
                        this.pythonPath = path.join(this.venvDir, 'Scripts', 'python.exe');
                        this.pipPath = path.join(this.venvDir, 'Scripts', 'pip.exe');
                    } else {
                        this.pythonPath = path.join(this.venvDir, 'bin', 'python');
                        this.pipPath = path.join(this.venvDir, 'bin', 'pip');
                    }
                    
                    this.usingVirtualEnv = true;
                    
                    // Verify venv
                    const checkProcess = spawnSync(this.pythonPath, ['--version'], {
                        encoding: 'utf-8',
                        timeout: 5000
                    });
                    
                    if (checkProcess.status === 0) {
                        console.log(`🐍 Virtual Python: ${checkProcess.stdout.trim()}`);
                        resolve();
                    } else {
                        reject(new Error('Failed to verify virtual environment'));
                    }
                } else {
                    console.error('❌ Failed to create virtual environment:', stderrData);
                    reject(new Error(`Venv creation failed: ${stderrData}`));
                }
            });

            venvProcess.on('error', (err) => {
                console.error('❌ Venv process error:', err);
                reject(new Error(`Venv process failed: ${err.message}`));
            });
        });
    }

    async initializeWithSystemPython() {
        console.log('🔄 Falling back to system Python with --break-system-packages');
        
        try {
            // Find system Python
            let pythonCommand = 'python3';
            let result = spawnSync(pythonCommand, ['--version'], {
                encoding: 'utf-8',
                timeout: 5000
            });
            
            if (result.status !== 0) {
                pythonCommand = 'python';
                result = spawnSync(pythonCommand, ['--version'], {
                    encoding: 'utf-8',
                    timeout: 5000
                });
            }
            
            if (result.status === 0) {
                this.pythonPath = pythonCommand;
                this.pipPath = pythonCommand + ' -m pip';
                this.usingVirtualEnv = false;
                
                console.log(`🐍 Using system Python: ${result.stdout.trim()}`);
                
                // Try to install requirements with --break-system-packages
                await this.installRequirementsWithBreakFlag();
                
                this.initialized = true;
                console.log('✅ Python runner initialized with system Python');
            } else {
                throw new Error('No Python found');
            }
        } catch (error) {
            console.error('❌ System Python initialization failed:', error);
            throw error;
        }
    }

    async installRequirementsWithBreakFlag() {
        return new Promise((resolve, reject) => {
            console.log('📦 Installing requirements with --break-system-packages flag...');
            
            const installProcess = spawn(this.pythonPath, [
                '-m', 'pip', 'install',
                '-r', this.requirementsFile,
                '--break-system-packages',
                '--no-warn-script-location'
            ], {
                cwd: path.dirname(this.requirementsFile),
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 300000 // 5 minutes
            });

            let stdoutData = '';
            let stderrData = '';

            installProcess.stdout.on('data', (data) => {
                const output = data.toString();
                stdoutData += output;
                console.log('📦 Pip output:', output.trim());
            });

            installProcess.stderr.on('data', (data) => {
                const output = data.toString();
                stderrData += output;
                console.log('⚠️ Pip stderr:', output.trim());
            });

            installProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Requirements installed with --break-system-packages');
                    this.loadInstalledModules();
                    resolve();
                } else {
                    console.error('❌ Installation failed even with --break-system-packages');
                    reject(new Error(`Pip install failed: ${stderrData}`));
                }
            });

            installProcess.on('error', (err) => {
                console.error('❌ Pip process error:', err);
                reject(new Error(`Pip process failed: ${err.message}`));
            });
        });
    }

    async checkRequirements() {
        return new Promise((resolve, reject) => {
            try {
                if (!fs.existsSync(this.requirementsFile)) {
                    console.log('📄 Creating requirements.txt file...');
                    const defaultRequirements = `# Python requirements for Telegram Bot Platform
requests==2.31.0
beautifulsoup4==4.12.2
python-dotenv==1.0.0
aiohttp==3.8.5`;
                    
                    fs.writeFileSync(this.requirementsFile, defaultRequirements);
                    console.log('✅ Created basic requirements.txt');
                }
                
                const requirements = fs.readFileSync(this.requirementsFile, 'utf8');
                const moduleCount = requirements.split('\n').filter(line => 
                    line.trim() && !line.startsWith('#')
                ).length;
                
                console.log(`📄 Requirements file found: ${moduleCount} modules`);
                resolve(requirements);
            } catch (error) {
                reject(new Error('Requirements check failed: ' + error.message));
            }
        });
    }

    async installRequirements() {
        if (!this.usingVirtualEnv) {
            return this.installRequirementsWithBreakFlag();
        }
        
        return new Promise((resolve, reject) => {
            console.log('📦 Installing Python requirements in virtual environment...');
            
            // Upgrade pip first
            const pipUpgradeProcess = spawn(this.pipPath, [
                'install', '--upgrade', 'pip',
                '--quiet', '--disable-pip-version-check'
            ], {
                cwd: path.dirname(this.requirementsFile),
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 60000
            });

            pipUpgradeProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Pip upgraded successfully');
                } else {
                    console.warn('⚠️ Pip upgrade failed, continuing...');
                }
                
                // Now install requirements
                const installProcess = spawn(this.pipPath, [
                    'install', '-r', this.requirementsFile,
                    '--quiet', '--disable-pip-version-check'
                ], {
                    cwd: path.dirname(this.requirementsFile),
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 300000 // 5 minutes
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
                        console.log('✅ Python requirements installed successfully');
                        this.loadInstalledModules();
                        resolve();
                    } else {
                        console.error('❌ Requirements installation failed:', stderrData);
                        reject(new Error(`Pip install failed: ${stderrData || 'Unknown error'}`));
                    }
                });

                installProcess.on('error', (err) => {
                    console.error('❌ Pip process error:', err);
                    reject(new Error(`Pip process failed: ${err.message}`));
                });
            });

            pipUpgradeProcess.on('error', (err) => {
                console.error('❌ Pip upgrade error:', err);
                // Continue with installation anyway
                reject(err);
            });
        });
    }

    async loadInstalledModules() {
        try {
            const checkCmd = `
import sys
try:
    import pkg_resources
    modules = [d.key for d in pkg_resources.working_set]
    for module in modules:
        print(module)
except:
    # Fallback for basic modules
    for module in ["sys", "os", "json", "math", "datetime", "requests"]:
        try:
            __import__(module)
            print(module)
        except:
            pass
            `;

            const result = spawnSync(this.pythonPath, ['-c', checkCmd], {
                encoding: 'utf-8',
                timeout: 10000
            });

            if (result.status === 0 && result.stdout) {
                const modules = result.stdout.trim().split('\n').filter(m => m);
                modules.forEach(module => {
                    this.installedModules.add(module.toLowerCase());
                });
                console.log(`✅ Loaded ${this.installedModules.size} installed modules`);
            }
        } catch (error) {
            console.error('❌ Failed to load installed modules:', error);
        }
    }

    // ✅ BASIC Python execution method (always works)
    async runBasicPython(code) {
        return new Promise((resolve, reject) => {
            console.log('🐍 Running basic Python code...');
            
            const tempFile = path.join(this.tempDir, `basic_${Date.now()}.py`);
            
            // Simple Python template without imports
            const pythonTemplate = `# Basic Python Execution
import sys

try:
${this.indentCode(code, 4)}
    print("SUCCESS: Code executed")
except Exception as e:
    print(f"ERROR: {str(e)}")
    sys.exit(1)`;

            fs.writeFileSync(tempFile, pythonTemplate);
            
            const pythonCommand = this.pythonPath || 'python3';
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
                try {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }

                if (code !== 0) {
                    reject(new Error(stderrData || 'Python execution failed'));
                    return;
                }

                resolve(stdoutData.trim());
            });

            pythonProcess.on('error', (err) => {
                try {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }
                reject(new Error(`Python process failed: ${err.message}`));
            });
        });
    }

    // ✅ MAIN runPythonCode method (updated)
    async runPythonCode(code) {
        // First, try to initialize if not already done
        if (!this.initialized) {
            try {
                await this.initialize();
            } catch (error) {
                console.warn('⚠️ Python runner not fully initialized, using basic mode');
            }
        }
        
        // Check for imports that might fail
        const hasExternalImports = /import\s+(requests|pandas|numpy|telethon|bs4|PIL|aiohttp)/.test(code);
        
        if (hasExternalImports && !this.usingVirtualEnv && this.installedModules.size === 0) {
            // Try basic execution first
            try {
                return await this.runBasicPython(code);
            } catch (error) {
                // If basic fails, return informative error
                throw new Error(`Python module issue: ${error.message}. Try running /python setup first.`);
            }
        }
        
        // Proceed with normal execution
        return new Promise((resolve, reject) => {
            console.log('🐍 Running Python code...');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            const pythonTemplate = `# Python Code Execution
import sys
import json

def main():
    try:
${this.indentCode(code, 8)}
        return {"success": True, "output": "Code executed successfully"}
    except Exception as e:
        return {"success": False, "error": str(e), "type": type(e).__name__}

if __name__ == "__main__":
    result = main()
    print(json.dumps(result))`;

            fs.writeFileSync(tempFile, pythonTemplate);
            
            const pythonCommand = this.pythonPath || process.env.PYTHON_PATH || 'python3';
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
                try {
                    if (fs.existsSync(tempFile)) {
                        fs.unlinkSync(tempFile);
                    }
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }

                if (code !== 0) {
                    reject(new Error(stderrData || 'Python execution failed'));
                    return;
                }

                try {
                    const result = JSON.parse(stdoutData);
                    if (result.success) {
                        resolve(result.output || 'Code executed successfully');
                    } else {
                        reject(new Error(`Python Error: ${result.error}`));
                    }
                } catch (parseError) {
                    resolve(stdoutData.trim() || 'Code executed (no output)');
                }
            });

            pythonProcess.on('error', (err) => {
                try {
                    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
                } catch (cleanupError) {
                    console.error('❌ Temp file cleanup error:', cleanupError);
                }
                reject(new Error(`Python process failed: ${err.message}`));
            });
        });
    }

    // ✅ SYNC VERSION
    runPythonCodeSync(code) {
        try {
            console.log('🐍 Running Python code synchronously');
            
            if (this.isSimpleExpression(code)) {
                return this.runSimpleExpressionSync(code);
            }
            
            return this.runPythonFileSync(code);
            
        } catch (error) {
            console.error('❌ runPythonCodeSync error:', error);
            throw error;
        }
    }

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
            return output;

        } catch (error) {
            console.error('❌ Simple expression error:', error);
            throw error;
        }
    }

    runPythonFileSync(code) {
        try {
            const tempFile = path.join(this.tempDir, `script_sync_${Date.now()}.py`);
            
            const pythonTemplate = `# Python Code Execution
import sys
import json

def main():
    try:
${this.indentCode(code, 8)}
        return {"success": True, "output": "Code executed successfully"}
    except Exception as e:
        return {"success": False, "error": str(e), "type": type(e).__name__}

if __name__ == "__main__":
    result = main()
    print(json.dumps(result))`;

            fs.writeFileSync(tempFile, pythonTemplate);
            
            const pythonCommand = this.pythonPath || process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

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

            const stdout = result.stdout ? result.stdout.trim() : '';
            if (stdout) {
                try {
                    const parsed = JSON.parse(stdout);
                    if (parsed.success) {
                        return parsed.output || 'Code executed successfully';
                    } else {
                        throw new Error(`Python Error: ${parsed.error}`);
                    }
                } catch (parseError) {
                    return stdout || 'Code executed (no output)';
                }
            }

            return 'Code executed (no output)';

        } catch (error) {
            console.error('❌ Python file execution error:', error);
            throw error;
        }
    }

    isSimpleExpression(code) {
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        const trimmed = code.trim();
        return simplePattern.test(trimmed) && 
               !trimmed.includes('\n') && 
               !trimmed.includes('import') && 
               !trimmed.includes('def ') &&
               !trimmed.includes('print(');
    }

    indentCode(code, spaces = 4) {
        const lines = code.split('\n');
        const indentedLines = lines.map(line => {
            if (line.trim() === '') return '';
            return ' '.repeat(spaces) + line;
        });
        return indentedLines.join('\n');
    }

    // ✅ NEW: Python setup command
    async setupPythonEnvironment() {
        try {
            console.log('🔧 Running Python environment setup...');
            
            if (!this.initialized) {
                await this.initialize();
            }
            
            const info = await this.getPythonInfo();
            
            return {
                success: true,
                usingVirtualEnv: this.usingVirtualEnv,
                pythonPath: this.pythonPath,
                pipPath: this.pipPath,
                installedModules: Array.from(this.installedModules),
                info: info
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                usingVirtualEnv: this.usingVirtualEnv
            };
        }
    }

    async getPythonInfo() {
        try {
            const versionResult = spawnSync(this.pythonPath, ['--version'], {
                encoding: 'utf-8',
                timeout: 5000
            });

            const sysResult = spawnSync(this.pythonPath, ['-c', `
import sys
import json
info = {
    "version": sys.version,
    "executable": sys.executable,
    "platform": sys.platform,
    "prefix": sys.prefix
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

    // ✅ Install specific module
    async installPythonLibrary(libraryName) {
        return new Promise((resolve, reject) => {
            console.log(`📦 Installing: ${libraryName}`);
            
            let installArgs = ['install', libraryName];
            
            if (!this.usingVirtualEnv) {
                installArgs.push('--break-system-packages');
            }
            
            let installProcess;
            
            if (this.pipPath.includes(' -m ')) {
                const parts = this.pipPath.split(' ');
                installProcess = spawn(parts[0], ['-m', 'pip', ...installArgs], {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 120000
                });
            } else {
                installProcess = spawn(this.pipPath, installArgs, {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 120000
                });
            }

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
                    console.log(`✅ Installed: ${libraryName}`);
                    this.installedModules.add(libraryName.toLowerCase());
                    resolve({ 
                        library: libraryName, 
                        installed: true,
                        output: stdoutData 
                    });
                } else {
                    reject(new Error(stderrData || `Failed to install ${libraryName}`));
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