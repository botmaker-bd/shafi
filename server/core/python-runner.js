const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const supabase = require('../config/supabase');

class PythonRunner {
    constructor() {
        // টেম্পোরারি ফোল্ডার তৈরি
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
            console.error('❌ Python runner initialization failed:', error.message);
        }
    }

    // পাইথন ইনস্টল আছে কিনা চেক করা
    async checkPython() {
        return new Promise((resolve, reject) => {
            const check = (cmd) => {
                const p = spawn(cmd, ['--version']);
                p.on('error', () => null);
                p.on('close', (code) => code === 0 ? resolve(cmd) : null);
            };
            
            // Try python3 first, then python
            const p3 = spawn('python3', ['--version']);
            p3.on('error', () => {
                const p = spawn('python', ['--version']);
                p.on('error', () => reject(new Error('Python not found')));
                p.on('close', (c) => c === 0 ? resolve('python') : reject(new Error('Python not installed')));
            });
            p3.on('close', (c) => c === 0 ? resolve('python3') : null);
        });
    }

    // 🔄 MAIN EXECUTION FUNCTION (ASYNC)
    async runPythonCodeAsync(code) {
        // 1. ছোট অংক হলে দ্রুত রান করবে (Simple Math)
        if (this.isSimpleExpression(code)) {
            return this.runSimpleExpressionAsync(code);
        }
        
        // 2. বড় কোড হলে ফাইল বানিয়ে রান করবে
        return this.runPythonFileAsync(code);
    }

    // Compatibility Alias (যাতে আগের কোড না ভাঙে)
    // নোট: এটি এখন Promise রিটার্ন করে, তাই caller কে 'await' ব্যবহার করতে হবে
    async runPythonCodeSync(code) {
        return this.runPythonCodeAsync(code);
    }

    isSimpleExpression(code) {
        // যেমন: 2 + 2, 100 * 50
        const simplePattern = /^[0-9+\-*/().\s]+$/;
        return simplePattern.test(code.trim()) && !code.includes('\n');
    }

    // ছোট এক্সপ্রেশন রানার
    async runSimpleExpressionAsync(expression) {
        return new Promise((resolve, reject) => {
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const process = spawn(pythonCommand, ['-c', `print(${expression})`]);
            
            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (d) => output += d.toString());
            process.stderr.on('data', (d) => errorOutput += d.toString());

            process.on('close', (code) => {
                if (code !== 0) reject(new Error(errorOutput || 'Calculation failed'));
                else resolve(output.trim());
            });

            // 5 সেকেন্ড টাইমআউট
            setTimeout(() => {
                process.kill();
                reject(new Error('Timeout: Expression took too long'));
            }, 5000);
        });
    }

    // 🐍 ফাইল রানার (এডভান্সড)
    async runPythonFileAsync(code) {
        const tempFile = path.join(this.tempDir, `script_${Date.now()}.py`);
        
        // স্মার্ট টেমপ্লেট: এটি 'result' ভেরিয়েবল অটোমেটিক প্রিন্ট করে
        const pythonTemplate = `# Python Execution Wrapper
import sys
import json

try:
${this.indentCode(code)}

    # Auto-detect 'result' variable
    if 'result' in locals():
        val = locals()['result']
        if isinstance(val, (dict, list)):
            print(json.dumps(val, indent=2)) # JSON format for objects
        else:
            print(str(val))
            
    elif 'result' in globals():
        val = globals()['result']
        print(str(val))
        
    else:
        # যদি ইউজার নিজে print() করে থাকে, তাহলে কিছু করার দরকার নেই
        pass 

except Exception as e:
    # এরর হলে stderr এ পাঠানো হবে
    print(f"{str(e)}", file=sys.stderr)
    sys.exit(1)
`;

        fs.writeFileSync(tempFile, pythonTemplate);

        return new Promise((resolve, reject) => {
            const pythonCommand = process.env.PYTHON_PATH || 'python3';
            const process = spawn(pythonCommand, [tempFile], { cwd: this.tempDir });

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (d) => output += d.toString());
            process.stderr.on('data', (d) => errorOutput += d.toString());

            process.on('close', (code) => {
                // ফাইল ডিলিট
                try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch(e){}

                if (code !== 0) {
                    // ক্লিন এরর মেসেজ
                    const cleanError = errorOutput.trim();
                    reject(new Error(cleanError || 'Python script failed'));
                } else {
                    const finalOutput = output.trim();
                    resolve(finalOutput || "✅ Code executed successfully (No output)");
                }
            });

            // ⏱️ ৩০ সেকেন্ড টাইমআউট (Infinite Loop Protection)
            setTimeout(() => {
                process.kill();
                try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch(e){}
                reject(new Error('⏱️ Timeout: Script execution exceeded 30 seconds'));
            }, 30000);
        });
    }

    indentCode(code) {
        return code.split('\n').map(line => '    ' + line).join('\n');
    }

    // লাইব্রেরি ইনস্টলার (pip)
    async installPythonLibrary(libraryName) {
        console.log(`📦 Installing: ${libraryName}...`);
        return new Promise((resolve, reject) => {
            const pipCommand = process.env.PIP_PATH || 'pip3';
            const process = spawn(pipCommand, ['install', libraryName]);
            
            process.on('close', async (code) => {
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