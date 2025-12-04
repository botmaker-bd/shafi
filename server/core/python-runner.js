// server/core/python-runner.js - FIXED VERSION
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
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.checkPython();
            await this.ensureRequirements();
            this.initialized = true;
            console.log('✅ Python runner initialized successfully');
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error);
        }
    }

    async checkPython() {
        return new Promise((resolve, reject) => {
            try {
                const result = spawnSync('python3', ['--version'], { 
                    encoding: 'utf-8',
                    timeout: 5000 
                });
                if (result.status === 0) {
                    this.pythonPath = 'python3';
                    this.pipPath = 'pip3';
                    console.log('🐍 Python3 found:', result.stdout.trim());
                    resolve();
                } else {
                    const result2 = spawnSync('python', ['--version'], { 
                        encoding: 'utf-8',
                        timeout: 5000 
                    });
                    if (result2.status === 0) {
                        this.pythonPath = 'python';
                        this.pipPath = 'pip';
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

    // ✅ NEW: Ensure requirements are installed
    async ensureRequirements() {
        console.log('📦 Ensuring Python requirements are installed...');
        
        // Check if we're in a virtual environment
        const isInVenv = await this.checkVirtualEnv();
        
        if (!isInVenv) {
            console.log('⚠️ Not in virtual environment, installing globally...');
        }
        
        const requirements = [
            'requests==2.31.0',
            'telethon==1.28.5', 
            'pandas==2.1.1',
            'numpy==1.24.3',
            'beautifulsoup4==4.12.2',
            'Pillow==10.0.1',
            'python-dotenv==1.0.0',
            'aiohttp==3.8.5'
        ];
        
        for (const req of requirements) {
            const [moduleName, version] = req.split('==');
            await this.ensureModule(moduleName, version);
        }
    }

    // ✅ NEW: Check if module exists, install if not
    async ensureModule(moduleName, version) {
        return new Promise((resolve, reject) => {
            console.log(`🔍 Checking module: ${moduleName}`);
            
            const checkCode = `
try:
    import ${moduleName}
    print("INSTALLED")
except ImportError:
    print("NOT_INSTALLED")
`;
            
            const checkProcess = spawn(this.pythonPath, ['-c', checkCode], {
                encoding: 'utf-8',
                timeout: 10000
            });

            let output = '';
            checkProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            checkProcess.on('close', (code) => {
                if (output.includes('NOT_INSTALLED')) {
                    console.log(`📦 Installing ${moduleName}...`);
                    this.installModule(moduleName, version)
                        .then(resolve)
                        .catch(reject);
                } else {
                    console.log(`✅ ${moduleName} already installed`);
                    resolve();
                }
            });

            checkProcess.on('error', (err) => {
                console.error(`❌ Module check error for ${moduleName}:`, err);
                reject(err);
            });
        });
    }

    // ✅ NEW: Install module with retry logic
    async installModule(moduleName, version = '') {
        return new Promise((resolve, reject) => {
            const installCmd = version ? `${moduleName}==${version}` : moduleName;
            
            console.log(`🚀 Installing: ${installCmd}`);
            
            const pipProcess = spawn(this.pipPath, [
                'install', 
                installCmd,
                '--quiet',
                '--disable-pip-version-check'
            ], {
                encoding: 'utf-8',
                timeout: 300000 // 5 minutes
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
                    console.log(`✅ Successfully installed ${moduleName}`);
                    resolve({ 
                        module: moduleName, 
                        version: version,
                        installed: true 
                    });
                } else {
                    // Try without version
                    if (version) {
                        console.log(`🔄 Retrying without version specifier...`);
                        this.installModule(moduleName)
                            .then(resolve)
                            .catch(reject);
                    } else {
                        console.error(`❌ Failed to install ${moduleName}:`, stderrData);
                        reject(new Error(`Failed to install ${moduleName}: ${stderrData}`));
                    }
                }
            });

            pipProcess.on('error', (err) => {
                console.error(`❌ Install process error for ${moduleName}:`, err);
                reject(err);
            });
        });
    }

    // ✅ NEW: Check virtual environment
    async checkVirtualEnv() {
        return new Promise((resolve) => {
            const checkProcess = spawn(this.pythonPath, ['-c', 'import sys; print("VIRTUAL_ENV" if hasattr(sys, "real_prefix") or (hasattr(sys, "base_prefix") and sys.base_prefix != sys.prefix) else "NO_VENV")'], {
                encoding: 'utf-8',
                timeout: 5000
            });

            let output = '';
            checkProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            checkProcess.on('close', () => {
                resolve(output.includes('VIRTUAL_ENV'));
            });
        });
    }

    // ✅ FIXED: runPythonCode method with better error handling
    async runPythonCode(code) {
        await this.initialize(); // Ensure Python is ready
        
        return new Promise((resolve, reject) => {
            console.log('🐍 Running Python code');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // ✅ IMPROVED: Better Python template with module imports
            const pythonTemplate = `# Python Code Execution
import sys
import json
import traceback

# Try to import common modules
def safe_import(module_name, import_name=None):
    try:
        if import_name:
            return __import__(import_name)
        return __import__(module_name)
    except ImportError:
        return None

# Available modules check
modules_available = {}
common_modules = [
    'requests', 'telethon', 'pandas', 'numpy', 
    'bs4', 'PIL', 'dotenv', 'aiohttp'
]

for mod in common_modules:
    if mod == 'bs4':
        modules_available['bs4'] = safe_import('bs4', 'bs4')
    elif mod == 'PIL':
        modules_available['PIL'] = safe_import('PIL', 'PIL.Image')
    else:
        modules_available[mod] = safe_import(mod)

def main():
    try:
        # Make modules available in local scope
        for name, module in modules_available.items():
            if module:
                globals()[name] = module
        
${this.indentCode(code, 8)}
        
        return {"success": True, "output": "Code executed successfully"}
    except Exception as e:
        return {
            "success": False, 
            "error": str(e), 
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    result = main()
    print(json.dumps(result, default=str))`;

            // Write to temp file
            fs.writeFileSync(tempFile, pythonTemplate);
            console.log(`📄 Created temp Python file: ${tempFile}`);

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
                    console.error(`Stderr: ${stderrData}`);
                    reject(new Error(`Python execution failed: ${stderrData}`));
                    return;
                }

                try {
                    // Try to parse JSON output
                    const result = JSON.parse(stdoutData);
                    if (result.success) {
                        resolve(result.output || 'Code executed successfully');
                    } else {
                        const errorMsg = result.error || 'Unknown Python error';
                        const fullError = result.traceback ? 
                            `${errorMsg}\n\nTraceback:\n${result.traceback}` : 
                            errorMsg;
                        reject(new Error(fullError));
                    }
                } catch (parseError) {
                    // If not JSON, return raw output
                    console.log('⚠️ Raw output (not JSON):', stdoutData);
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

    // ✅ FIXED: runPythonCodeSync with module check
    runPythonCodeSync(code) {
        try {
            console.log('🐍 Running Python code synchronously');
            
            // Check if it's a simple expression
            if (this.isSimpleExpression(code)) {
                return this.runSimpleExpressionSync(code);
            }
            
            // For code that needs modules
            const tempFile = path.join(this.tempDir, `script_sync_${Date.now()}.py`);
            
            // Better template for sync execution
            const pythonTemplate = `# Python Code Execution
import sys
import json
import traceback
import subprocess

def install_module(module_name):
    """Install module if not available"""
    try:
        __import__(module_name)
        return True
    except ImportError:
        try:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', module_name, '--quiet'])
            return True
        except:
            return False

# Common modules to check
common_modules = ['requests', 'json', 'os', 'sys', 'math', 'datetime']
for mod in common_modules:
    install_module(mod)

def main():
    try:
${this.indentCode(code, 8)}
        return {"success": True, "output": "Code executed successfully"}
    except Exception as e:
        return {
            "success": False, 
            "error": str(e), 
            "type": type(e).__name__,
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    result = main()
    print(json.dumps(result, default=str))`;

            fs.writeFileSync(tempFile, pythonTemplate);
            console.log('📄 Python sync file created:', tempFile);
            
            const pythonCommand = this.pythonPath || process.env.PYTHON_PATH || 'python3';
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

            // Check for errors
            if (result.error) {
                throw new Error(`Python process error: ${result.error.message}`);
            }

            if (result.status !== 0) {
                const errorMsg = result.stderr?.toString() || result.stdout?.toString() || 'Python execution failed';
                throw new Error(errorMsg);
            }

            // Parse output
            const stdout = result.stdout?.toString().trim() || '';
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

    // ✅ NEW: Test Python installation
    async testPythonInstallation() {
        const testCode = `
import sys
import subprocess
import json

results = {
    "python_version": sys.version,
    "python_path": sys.executable,
    "modules": {}
}

# Test basic modules
basic_modules = ['os', 'sys', 'json', 'math', 'datetime', 'subprocess']
for mod in basic_modules:
    try:
        __import__(mod)
        results["modules"][mod] = "✅ Available"
    except ImportError:
        results["modules"][mod] = "❌ Missing"

# Test required modules
required_modules = [
    'requests', 'telethon', 'pandas', 'numpy',
    'bs4', 'PIL', 'dotenv', 'aiohttp'
]

for mod in required_modules:
    try:
        if mod == 'bs4':
            __import__('bs4')
            results["modules"][mod] = "✅ Available"
        elif mod == 'PIL':
            __import__('PIL.Image')
            results["modules"][mod] = "✅ Available"
        else:
            __import__(mod)
            results["modules"][mod] = "✅ Available"
    except ImportError:
        results["modules"][mod] = "❌ Missing"

print(json.dumps(results, indent=2))
`;
        
        return await this.runPythonCode(testCode);
    }

    // Rest of the methods remain the same...
    isSimpleExpression(code) {
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        const trimmed = code.trim();
        return simplePattern.test(trimmed) && 
               !trimmed.includes('\n') && 
               !trimmed.includes('import') && 
               !trimmed.includes('def ') &&
               !trimmed.includes('print(');
    }

    runSimpleExpressionSync(expression) {
        try {
            console.log('🔧 Running simple expression:', expression);
            
            const pythonCommand = this.pythonPath || process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, ['-c', `print(${expression})`], {
                timeout: 10000,
                encoding: 'utf-8'
            });

            if (result.error) {
                throw new Error(`Python process error: ${result.error.message}`);
            }

            if (result.status !== 0) {
                throw new Error(result.stderr?.toString() || 'Python execution failed');
            }

            const output = result.stdout?.toString().trim() || 'No output';
            console.log('✅ Simple expression result:', output);
            return output;

        } catch (error) {
            console.error('❌ Simple expression error:', error);
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

    async installPythonLibrary(libraryName) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            console.log(`📦 Installing Python library: ${libraryName}`);
            
            const pipCommand = this.pipPath || process.env.PIP_PATH || 'pip3';
            const pipProcess = spawn(pipCommand, ['install', libraryName], {
                encoding: 'utf-8',
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
                    this.saveInstalledLibrary(libraryName).catch(console.error);
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


    // ✅ SAVE INSTALLED LIBRARY INFO
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

    // ✅ GET INSTALLED LIBRARIES
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

    // ✅ UNINSTALL LIBRARY
    async uninstallPythonLibrary(libraryName) {
        return new Promise((resolve, reject) => {
            console.log(`🗑️ Uninstalling Python library: ${libraryName}`);
            
            const pipCommand = process.env.PIP_PATH || 'pip3';
            const pipProcess = spawn(pipCommand, ['uninstall', libraryName, '-y'], {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 60000
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
                    console.log(`✅ Successfully uninstalled ${libraryName}`);
                    // Update database in background
                    this.removeInstalledLibrary(libraryName).catch(console.error);
                    resolve({ 
                        library: libraryName, 
                        uninstalled: true,
                        output: stdoutData 
                    });
                } else {
                    reject(new Error(stderrData || `Failed to uninstall ${libraryName}`));
                }
            });

            pipProcess.on('error', (err) => {
                reject(new Error(`Pip process failed: ${err.message}`));
            });
        });
    }

    // ✅ REMOVE LIBRARY FROM DATABASE
    async removeInstalledLibrary(libraryName) {
        try {
            const { data: currentData } = await supabase
                .from('universal_data')
                .select('data_value')
                .eq('data_type', 'system')
                .eq('data_key', 'python_libraries')
                .single();

            if (currentData && currentData.data_value) {
                try {
                    let libraries = JSON.parse(currentData.data_value);
                    libraries = libraries.filter(lib => lib !== libraryName);
                    
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
                    
                    console.log(`🗑️ Removed library from DB: ${libraryName}`);
                } catch (e) {
                    console.error('❌ Parse error removing library:', e);
                }
            }
        } catch (error) {
            console.error('❌ Remove library error:', error);
        }
    }
}

// Create singleton instance
const pythonRunnerInstance = new PythonRunner();

module.exports = pythonRunnerInstance;