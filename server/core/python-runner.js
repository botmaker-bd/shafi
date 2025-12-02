const { spawn } = require('child_process');
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
            console.error('❌ Python runner init failed:', error.message);
        }
    }

    async checkPython() {
        return new Promise((resolve, reject) => {
            const p3 = spawn('python3', ['--version']);
            p3.on('error', () => {
                const p = spawn('python', ['--version']);
                p.on('error', () => reject(new Error('Python not found')));
                p.on('close', (c) => c === 0 ? resolve('python') : reject(new Error('Python not installed')));
            });
            p3.on('close', (c) => c === 0 ? resolve('python3') : null);
        });
    }

    async runPythonCodeAsync(code) {
        if (this.isSimpleExpression(code)) {
            return this.runSimpleExpressionAsync(code);
        }
        return this.runPythonFileAsync(code);
    }

    // Backwards compatibility
    async runPythonCodeSync(code) {
        return this.runPythonCodeAsync(code);
    }

    isSimpleExpression(code) {
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        return simplePattern.test(code.trim()) && !code.includes('\n');
    }

    async runSimpleExpressionAsync(expression) {
        return new Promise((resolve, reject) => {
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            
            // 🔴 FIX: Renamed variable from 'process' to 'pythonProcess' to avoid Global conflict
            const pythonProcess = spawn(pythonCommand, ['-c', `print(${expression})`]);
            
            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (d) => output += d.toString());
            pythonProcess.stderr.on('data', (d) => errorOutput += d.toString());

            pythonProcess.on('close', (code) => {
                if (code !== 0) reject(new Error(errorOutput || 'Calculation failed'));
                else resolve(output.trim());
            });

            setTimeout(() => {
                pythonProcess.kill();
                reject(new Error('Timeout: Expression took too long'));
            }, 5000);
        });
    }

    async runPythonFileAsync(code) {
        const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
        
        const pythonTemplate = `# Python Execution Wrapper
import sys
import json

try:
${this.indentCode(code)}

    if 'result' in locals():
        val = locals()['result']
        if isinstance(val, (dict, list)):
            print(json.dumps(val, indent=2))
        else:
            print(str(val))
    elif 'result' in globals():
        val = globals()['result']
        print(str(val))
    else:
        pass 

except Exception as e:
    print(f"{str(e)}", file=sys.stderr)
    sys.exit(1)
`;

        fs.writeFileSync(tempFile, pythonTemplate);

        return new Promise((resolve, reject) => {
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            
            // 🔴 FIX: Renamed variable from 'process' to 'pythonProcess'
            const pythonProcess = spawn(pythonCommand, [tempFile], { cwd: this.tempDir });

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (d) => output += d.toString());
            pythonProcess.stderr.on('data', (d) => errorOutput += d.toString());

            pythonProcess.on('close', (code) => {
                try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch(e){}

                if (code !== 0) {
                    const cleanError = errorOutput.trim();
                    reject(new Error(cleanError || 'Python script failed'));
                } else {
                    resolve(output.trim() || "✅ Code executed successfully");
                }
            });

            setTimeout(() => {
                pythonProcess.kill();
                try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch(e){}
                reject(new Error('⏱️ Timeout: Script execution exceeded 30 seconds'));
            }, 30000);
        });
    }

    indentCode(code) {
        return code.split('\n').map(line => '    ' + line).join('\n');
    }

    async installPythonLibrary(libraryName) {
        return new Promise((resolve, reject) => {
            const pipCommand = process.env.PIP_PATH || 'pip3';
            // 🔴 FIX: Variable name conflict check
            const installProcess = spawn(pipCommand, ['install', libraryName]);
            
            installProcess.on('close', async (code) => {
                if (code === 0) {
                    await this.saveInstalledLibrary(libraryName);
                    resolve({ library: libraryName, installed: true });
                } else {
                    reject(new Error(`Failed to install ${libraryName}`));
                }
            });
        });
    }

    async saveInstalledLibrary(libraryName) {
        try {
            const { data } = await supabase.from('universal_data')
                .select('data_value').eq('data_key', 'python_libraries').single();
            
            let libs = data ? JSON.parse(data.data_value) : [];
            if (!libs.includes(libraryName)) {
                libs.push(libraryName);
                await supabase.from('universal_data').upsert({
                    data_type: 'system', data_key: 'python_libraries', 
                    data_value: JSON.stringify(libs)
                }, { onConflict: 'data_type,data_key' });
            }
        } catch (e) { console.error('Lib Save Error:', e); }
    }
}

const pythonRunnerInstance = new PythonRunner();
module.exports = pythonRunnerInstance;