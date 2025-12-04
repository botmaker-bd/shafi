// server/core/python-runner.js - COMPLETELY FIXED WITH spawn
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
                const result = spawnSync('python3', ['--version'], { 
                    encoding: 'utf-8',
                    timeout: 5000 
                });
                if (result.status === 0) {
                    console.log('🐍 Python3 found:', result.stdout.trim());
                    resolve();
                } else {
                    const result2 = spawnSync('python', ['--version'], { 
                        encoding: 'utf-8',
                        timeout: 5000 
                    });
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

    // ✅ SYNC VERSION - Fix for "pythonRunner.runPythonCodeSync is not a function"
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

    // ✅ ASYNC VERSION
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

            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            
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
            
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
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
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
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

    // ✅ INSTALL PYTHON LIBRARY
    async installPythonLibrary(libraryName) {
        await this.initialize();
        return new Promise((resolve, reject) => {
            console.log(`📦 Installing Python library: ${libraryName}`);
            
            const pipCommand = process.env.PIP_PATH || 'pip3';
            const pipProcess = spawn(pipCommand, ['install', libraryName], {
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
                    // Save to database in background
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