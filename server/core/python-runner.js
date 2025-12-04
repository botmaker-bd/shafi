// server/core/python-runner.js - আপডেটেড ভার্সন
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class PythonRunner {
    constructor() {
        this.tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    // ✅ CLEAN Python execution - NO JSON parsing issues
    async runPythonCode(code) {
        return new Promise((resolve, reject) => {
            console.log('🐍 Running Python code...');
            
            const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
            
            // Clean Python template
            const pythonTemplate = `import sys
import traceback

def main():
${this.indentCode(code, 4)}

if __name__ == "__main__":
    try:
        result = main()
        if result is not None:
            print(str(result))
        else:
            print("SUCCESS")
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"ERROR: {error_msg}")
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

                const output = stdoutData.trim();
                const errorOutput = stderrData.trim();

                if (code !== 0) {
                    // Python error occurred
                    const errorMsg = output.startsWith('ERROR: ') 
                        ? output.substring(7) 
                        : errorOutput || 'Python execution failed';
                    
                    console.error('❌ Python error:', errorMsg);
                    reject(new Error(errorMsg));
                    return;
                }

                // Success
                if (output === 'SUCCESS') {
                    resolve('Code executed successfully');
                } else {
                    resolve(output);
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
        
        try {
            const tempFile = path.join(this.tempDir, `script_sync_${Date.now()}.py`);
            
            const pythonTemplate = `import sys
import traceback

def main():
${this.indentCode(code, 4)}

if __name__ == "__main__":
    try:
        result = main()
        if result is not None:
            print(str(result))
        else:
            print("SUCCESS")
    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"ERROR: {error_msg}")
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

            const output = result.stdout ? result.stdout.trim() : '';
            const errorOutput = result.stderr ? result.stderr.trim() : '';

            if (result.status !== 0) {
                const errorMsg = output.startsWith('ERROR: ') 
                    ? output.substring(7) 
                    : errorOutput || 'Python execution failed';
                
                throw new Error(errorMsg);
            }

            if (output === 'SUCCESS') {
                return 'Code executed successfully';
            }

            return output;

        } catch (error) {
            console.error('❌ Python execution error:', error);
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
}

const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;