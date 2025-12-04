// server/core/python-runner.js - UPDATED VERSION
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
        this.installedModules = new Set();
        this.requirementsFile = path.join(__dirname, '../../requirements.txt');
        this.initialize();
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.checkPython();
            await this.checkPip();
            await this.checkRequirements();
            await this.installRequirements();
            
            this.initialized = true;
            console.log('✅ Python runner initialized successfully');
        } catch (error) {
            console.error('❌ Python runner initialization failed:', error);
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
                
                // Check environment variable
                if (process.env.PYTHON_PATH) {
                    this.pythonPath = process.env.PYTHON_PATH;
                    console.log('🐍 Python from env:', process.env.PYTHON_PATH);
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
                
                // Check python -m pip
                result = spawnSync(this.pythonPath, ['-m', 'pip', '--version'], {
                    encoding: 'utf-8',
                    timeout: 5000
                });
                
                if (result.status === 0) {
                    this.pipPath = this.pythonPath + ' -m pip';
                    console.log('📦 Pip via python -m pip');
                    resolve();
                    return;
                }
                
                reject(new Error('Pip is not installed'));
            } catch (error) {
                reject(new Error('Pip check failed: ' + error.message));
            }
        });
    }

    async checkRequirements() {
        return new Promise((resolve, reject) => {
            try {
                if (!fs.existsSync(this.requirementsFile)) {
                    console.log('📄 Creating requirements.txt file...');
                    const defaultRequirements = `telethon==1.28.5
pandas==2.1.1
numpy==1.24.3
requests==2.31.0
beautifulsoup4==4.12.2
Pillow==10.0.1
python-dotenv==1.0.0
aiohttp==3.8.5`;
                    
                    fs.writeFileSync(this.requirementsFile, defaultRequirements);
                    console.log('✅ Created requirements.txt');
                }
                
                const requirements = fs.readFileSync(this.requirementsFile, 'utf8');
                console.log('📄 Requirements file found:', requirements.split('\n').length, 'modules');
                resolve(requirements);
            } catch (error) {
                reject(new Error('Requirements check failed: ' + error.message));
            }
        });
    }

    async installRequirements() {
        return new Promise((resolve, reject) => {
            console.log('📦 Installing Python requirements...');
            
            let installProcess;
            
            if (this.pipPath.includes(' -m ')) {
                // python -m pip install -r requirements.txt
                const parts = this.pipPath.split(' ');
                installProcess = spawn(parts[0], ['-m', 'pip', 'install', '-r', this.requirementsFile], {
                    cwd: path.dirname(this.requirementsFile),
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 300000 // 5 minutes
                });
            } else {
                // pip install -r requirements.txt
                installProcess = spawn(this.pipPath, ['install', '-r', this.requirementsFile], {
                    cwd: path.dirname(this.requirementsFile),
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 300000
                });
            }

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

            // Timeout handler
            setTimeout(() => {
                if (installProcess.exitCode === null) {
                    installProcess.kill('SIGTERM');
                    reject(new Error('Requirements installation timeout (5 minutes)'));
                }
            }, 300000);
        });
    }

    async loadInstalledModules() {
        try {
            const result = spawnSync(this.pythonPath, ['-c', `
import pkg_resources
modules = [d.key for d in pkg_resources.working_set]
for module in modules:
    print(module)
            `], {
                encoding: 'utf-8',
                timeout: 10000
            });

            if (result.status === 0 && result.stdout) {
                const modules = result.stdout.trim().split('\n');
                modules.forEach(module => {
                    this.installedModules.add(module.toLowerCase());
                });
                console.log(`✅ Loaded ${this.installedModules.size} installed modules`);
            }
        } catch (error) {
            console.error('❌ Failed to load installed modules:', error);
        }
    }

    async ensureModuleInstalled(moduleName) {
        // Extract module name (remove version specifiers)
        const cleanModuleName = moduleName.split('==')[0].split('>')[0].split('<')[0].split('~')[0].trim();
        
        if (this.installedModules.has(cleanModuleName.toLowerCase())) {
            return true;
        }

        console.log(`📦 Module ${cleanModuleName} not found, installing...`);
        
        try {
            await this.installPythonLibrary(cleanModuleName);
            this.installedModules.add(cleanModuleName.toLowerCase());
            return true;
        } catch (error) {
            console.error(`❌ Failed to install ${cleanModuleName}:`, error.message);
            return false;
        }
    }

    async safeRunPythonCode(code) {
        // Extract import statements from code
        const importRegex = /^(?:from\s+([\w\.]+)|import\s+([\w\.]+(?:\s*,\s*\w+)*))/gm;
        const imports = [];
        let match;
        
        while ((match = importRegex.exec(code)) !== null) {
            if (match[1]) {
                imports.push(match[1].split('.')[0]);
            }
            if (match[2]) {
                match[2].split(',').forEach(imp => {
                    imports.push(imp.trim().split('.')[0]);
                });
            }
        }
        
        // Check and install missing modules
        for (const module of imports) {
            if (module && module !== 'sys' && module !== 'os' && module !== 'json' && module !== 'math') {
                await this.ensureModuleInstalled(module);
            }
        }
        
        // Run the code
        return await this.runPythonCode(code);
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

    // ✅ FIXED: ASYNC VERSION
    async runPythonCode(code) {
        return new Promise((resolve, reject) => {
            console.log('🐍 Running Python code asynchronously');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // Create Python template
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

                try {
                    // Try to parse JSON output
                    const result = JSON.parse(stdoutData);
                    if (result.success) {
                        resolve(result.output || 'Code executed successfully');
                    } else {
                        reject(new Error(`Python Error: ${result.error}`));
                    }
                } catch (parseError) {
                    // If not JSON, return raw output
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

def main():
    try:
${this.indentCode(code, 8)}
        # If no explicit return, capture print output
        return {"success": True, "output": "Code executed successfully"}
    except Exception as e:
        return {"success": False, "error": str(e), "type": type(e).__name__}

if __name__ == "__main__":
    result = main()
    print(json.dumps(result))`;

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

            // Try to parse JSON output
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

    // ✅ INSTALL PYTHON LIBRARY (IMPROVED)
    async installPythonLibrary(libraryName) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            console.log(`📦 Installing Python library: ${libraryName}`);
            
            let installProcess;
            
            if (this.pipPath.includes(' -m ')) {
                const parts = this.pipPath.split(' ');
                installProcess = spawn(parts[0], ['-m', 'pip', 'install', libraryName], {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 120000
                });
            } else {
                installProcess = spawn(this.pipPath, ['install', libraryName], {
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
                    console.log(`✅ Successfully installed ${libraryName}`);
                    // Save to database in background
                    this.saveInstalledLibrary(libraryName).catch(console.error);
                    
                    // Add to installed modules set
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
            
            let uninstallProcess;
            
            if (this.pipPath.includes(' -m ')) {
                const parts = this.pipPath.split(' ');
                uninstallProcess = spawn(parts[0], ['-m', 'pip', 'uninstall', libraryName, '-y'], {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 60000
                });
            } else {
                uninstallProcess = spawn(this.pipPath, ['uninstall', libraryName, '-y'], {
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'pipe'],
                    timeout: 60000
                });
            }

            let stdoutData = '';
            let stderrData = '';

            uninstallProcess.stdout.on('data', (data) => {
                stdoutData += data.toString();
            });

            uninstallProcess.stderr.on('data', (data) => {
                stderrData += data.toString();
            });

            uninstallProcess.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Successfully uninstalled ${libraryName}`);
                    // Update database in background
                    this.removeInstalledLibrary(libraryName).catch(console.error);
                    
                    // Remove from installed modules set
                    this.installedModules.delete(libraryName.toLowerCase());
                    
                    resolve({ 
                        library: libraryName, 
                        uninstalled: true,
                        output: stdoutData 
                    });
                } else {
                    reject(new Error(stderrData || `Failed to uninstall ${libraryName}`));
                }
            });

            uninstallProcess.on('error', (err) => {
                reject(new Error(`Pip process failed: ${err.message}`));
            });
        });
    }

    // ✅ NEW: Check module availability
    async checkModule(moduleName) {
        try {
            const result = spawnSync(this.pythonPath, ['-c', `
try:
    import ${moduleName}
    print("AVAILABLE")
except ImportError:
    print("NOT_AVAILABLE")
            `], {
                encoding: 'utf-8',
                timeout: 10000
            });

            return result.stdout && result.stdout.includes('AVAILABLE');
        } catch (error) {
            return false;
        }
    }

    // ✅ NEW: Get Python info
    async getPythonInfo() {
        try {
            const versionResult = spawnSync(this.pythonPath, ['--version'], {
                encoding: 'utf-8',
                timeout: 5000
            });

            const modulesResult = spawnSync(this.pythonPath, ['-c', `
import sys
import json

info = {
    "version": sys.version,
    "path": sys.executable,
    "platform": sys.platform
}

print(json.dumps(info))
            `], {
                encoding: 'utf-8',
                timeout: 10000
            });

            return {
                python: versionResult.stdout.trim(),
                info: modulesResult.stdout ? JSON.parse(modulesResult.stdout) : {},
                installedModules: Array.from(this.installedModules)
            };
        } catch (error) {
            return { error: error.message };
        }
    }
}

// Create singleton instance
const pythonRunnerInstance = new PythonRunner();

module.exports = pythonRunnerInstance;