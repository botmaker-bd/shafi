// server/core/python-runner.js - OPTIMIZED AND FIXED
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
            console.log('✅ Python runner initialized');
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

    // ✅ FIXED: SYNC VERSION (for command-executor.js)
    runPythonCodeSync(code) {
        try {
            console.log('🐍 Running Python code synchronously:', code.substring(0, 100) + '...');
            
            // Use async version with synchronous execution
            return this.runPythonFileSync(code);
            
        } catch (error) {
            console.error('❌ runPythonCodeSync error:', error);
            throw error;
        }
    }

    // ✅ FIXED: ASYNC VERSION (for api-wrapper.js)
    async runPythonCode(code) {
        try {
            console.log('🐍 Running Python code asynchronously:', code.substring(0, 100) + '...');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.py`);
            
            // ✅ FIXED: IMPROVED PYTHON TEMPLATE
            const pythonTemplate = `# Python Code Execution
import sys
import json
import io
import contextlib

def main():
    try:
        # Capture print output
        output_capture = io.StringIO()
        with contextlib.redirect_stdout(output_capture):
            # User code
${this.indentCode(code, 12)}
        
        # Get captured output
        printed_output = output_capture.getvalue().strip()
        
        # Return success with captured output
        return {
            "success": True, 
            "output": printed_output if printed_output else "Code executed successfully"
        }
    except Exception as e:
        return {
            "success": False, 
            "error": str(e), 
            "type": type(e).__name__,
            "traceback": str(e.__traceback__) if hasattr(e, '__traceback__') else None
        }

if __name__ == "__main__":
    result = main()
    print(json.dumps(result, ensure_ascii=False))`;

            // Write to temp file
            fs.writeFileSync(tempFile, pythonTemplate, 'utf8');
            
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            
            // Use spawn for async execution
            const pythonProcess = spawn(pythonCommand, [tempFile], {
                cwd: this.tempDir,
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 30000,
                shell: false
            });

            return new Promise((resolve, reject) => {
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
                    this.cleanupTempFile(tempFile);
                    
                    if (code !== 0) {
                        const errorMsg = stderrData || 'Python execution failed';
                        console.error(`❌ Python process exited with code ${code}:`, errorMsg);
                        reject(new Error(`Python Error: ${errorMsg}`));
                        return;
                    }

                    try {
                        // Try to parse JSON output
                        if (stdoutData.trim()) {
                            const result = JSON.parse(stdoutData);
                            if (result.success) {
                                resolve(result.output || 'Code executed successfully');
                            } else {
                                reject(new Error(`Python Error: ${result.error}`));
                            }
                        } else {
                            resolve('Code executed (no output)');
                        }
                    } catch (parseError) {
                        // If not JSON, return raw output
                        console.log('⚠️ Output was not JSON, returning raw:', stdoutData.substring(0, 200));
                        resolve(stdoutData.trim() || 'Code executed (no output)');
                    }
                });

                pythonProcess.on('error', (err) => {
                    this.cleanupTempFile(tempFile);
                    console.error('❌ Python process error:', err);
                    reject(new Error(`Python process failed to start: ${err.message}`));
                });

                // Handle timeout
                const timeout = setTimeout(() => {
                    if (pythonProcess.exitCode === null) {
                        pythonProcess.kill('SIGTERM');
                        this.cleanupTempFile(tempFile);
                        reject(new Error('Python execution timeout (30 seconds)'));
                    }
                }, 30000);

                // Clear timeout on completion
                pythonProcess.on('close', () => clearTimeout(timeout));
            });

        } catch (error) {
            console.error('❌ Python execution setup error:', error);
            throw error;
        }
    }

    // ✅ FIXED: RUN PYTHON FILE SYNC
    runPythonFileSync(code) {
        try {
            const tempFile = path.join(this.tempDir, `script_sync_${Date.now()}.py`);
            
            // Same improved template as async version
            const pythonTemplate = `# Python Code Execution
import sys
import json
import io
import contextlib

def main():
    try:
        # Capture print output
        output_capture = io.StringIO()
        with contextlib.redirect_stdout(output_capture):
            # User code
${this.indentCode(code, 12)}
        
        # Get captured output
        printed_output = output_capture.getvalue().strip()
        
        # Return success with captured output
        return {
            "success": True, 
            "output": printed_output if printed_output else "Code executed successfully"
        }
    except Exception as e:
        return {
            "success": False, 
            "error": str(e), 
            "type": type(e).__name__,
            "traceback": str(e.__traceback__) if hasattr(e, '__traceback__') else None
        }

if __name__ == "__main__":
    result = main()
    print(json.dumps(result, ensure_ascii=False))`;

            fs.writeFileSync(tempFile, pythonTemplate, 'utf8');
            
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const result = spawnSync(pythonCommand, [tempFile], {
                timeout: 30000,
                encoding: 'utf-8',
                cwd: this.tempDir,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.cleanupTempFile(tempFile);

            if (result.error) {
                throw new Error(`Python process error: ${result.error.message}`);
            }

            if (result.status !== 0) {
                const errorMsg = result.stderr || result.stdout || 'Python execution failed';
                throw new Error(`Python Error: ${errorMsg.split('\n')[0]}`);
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

    // ✅ NEW: Cleanup helper
    cleanupTempFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (cleanupError) {
            console.error('❌ Temp file cleanup error:', cleanupError.message);
        }
    }

    // ✅ FIXED: Better indentation
    indentCode(code, spaces = 4) {
        const lines = code.split('\n');
        const indentedLines = lines.map(line => {
            if (line.trim() === '') return '';
            return ' '.repeat(spaces) + line;
        });
        return indentedLines.join('\n');
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
                    this.saveInstalledLibrary(libraryName).catch(console.error);
                    resolve({ 
                        success: true,
                        library: libraryName, 
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
                    this.removeInstalledLibrary(libraryName).catch(console.error);
                    resolve({ 
                        success: true,
                        library: libraryName, 
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