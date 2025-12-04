// server/core/command-executor.js - ULTIMATE COMPLETE VERSION
const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');

async function executeCommandCode(botInstance, code, context) {
    // Basic Data Extraction
    const msg = context.msg || context;
    const userId = context.userId || msg?.from?.id;
    const botToken = context.botToken || '';
    const chatId = context.chatId || msg?.chat?.id;
    
    const userInput = context.userInput || msg?.text || '';
    const params = context.params || '';
    const nextCommandHandlers = context.nextCommandHandlers || new Map();
    
    if (!chatId) throw new Error("CRITICAL: Chat ID missing");
    
    const sessionKey = `sess_${userId}_${Date.now()}`;
    
    // Token Fallback
    let resolvedBotToken = botToken;
    if (!resolvedBotToken) {
        try { const i = await botInstance.getMe(); resolvedBotToken = i.token; } 
        catch (e) { resolvedBotToken = 'fallback'; }
    }

    try {
        // --- DATA LAYER (Supabase Wrapper) ---
        const createDataLayer = (type) => ({
            saveData: async (key, value) => {
                const { error } = await supabase.from('universal_data').upsert({
                    data_type: type, bot_token: resolvedBotToken, 
                    user_id: type === 'user_data' ? userId.toString() : null,
                    data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString()
                }, { onConflict: type === 'user_data' ? 'data_type,bot_token,user_id,data_key' : 'data_type,bot_token,data_key' });
                if (error) throw new Error(`${type} Save Failed: ${error.message}`);
                return value;
            },
            getData: async (key) => {
                const query = supabase.from('universal_data').select('data_value')
                    .eq('data_type', type).eq('bot_token', resolvedBotToken).eq('data_key', key);
                if (type === 'user_data') query.eq('user_id', userId.toString());
                const { data } = await query.maybeSingle();
                try { return data ? JSON.parse(data.data_value) : null; } catch { return data?.data_value; }
            },
            deleteData: async (key) => {
                const query = supabase.from('universal_data').delete()
                    .eq('data_type', type).eq('bot_token', resolvedBotToken).eq('data_key', key);
                if (type === 'user_data') query.eq('user_id', userId.toString());
                await query;
                return true;
            }
        });

        // --- INTERACTION LAYER (Wait For Answer) ---
        const waitForAnswerLogic = async (question, options = {}) => {
            return new Promise((resolve, reject) => {
                const waitKey = `${resolvedBotToken}_${userId}`;
                
                // প্রশ্ন পাঠানো (Bot Instance দিয়ে)
                botInstance.sendMessage(chatId, question, options).then(() => {
                    const timeout = setTimeout(() => {
                        if (nextCommandHandlers?.has(waitKey)) {
                            nextCommandHandlers.delete(waitKey);
                            reject(new Error('⏱️ Timeout: উত্তর দিতে দেরি হয়েছে।'));
                        }
                    }, 300 * 1000); // 5 মিনিট

                    nextCommandHandlers.set(waitKey, {
                        resolve: (ans) => { clearTimeout(timeout); resolve(ans); },
                        reject: (err) => { clearTimeout(timeout); reject(err); },
                        timestamp: Date.now()
                    });
                }).catch(reject);
            });
        };

        // --- ENVIRONMENT SETUP ---
        const apiCtx = { msg, chatId, userId, botToken: resolvedBotToken, userInput, params };
        const apiWrapper = new ApiWrapper(botInstance, apiCtx);

        // ✅ Bot.ask এবং Bot.waitForAnswer সেটআপ
        apiWrapper.ask = waitForAnswerLogic;
        apiWrapper.waitForAnswer = waitForAnswerLogic;

        const envObject = {
            Bot: apiWrapper, bot: apiWrapper,
            Api: apiWrapper, api: apiWrapper,
            
            // Data Objects
            User: createDataLayer('user_data'),
            BotData: createDataLayer('bot_data'), // Optional Alias
            
            // Context Variables
            msg, chatId, userId, userInput, params,
            
            // Utilities
            runPython: (c) => pythonRunner.runPythonCodeSync(c),
            ask: waitForAnswerLogic,
            wait: apiWrapper.wait,
            sleep: apiWrapper.sleep
        };

        // --- AUTO-AWAIT ENGINE ---
        const executeWithAutoAwait = async (userCode, env) => {
            const __autoAwait = {
                // Data Ops
                UserSave: (k, v) => env.User.saveData(k, v),
                UserGet: (k) => env.User.getData(k),
                UserDel: (k) => env.User.deleteData(k),
                BotDataSave: (k, v) => env.Bot.saveData(k, v),
                BotDataGet: (k) => env.Bot.getData(k),
                BotDataDel: (k) => env.Bot.deleteData(k),
                
                // Interaction
                Ask: (q, o) => env.ask(q, o),
                Wait: (s) => env.Bot.wait(s),
                Python: (c) => pythonRunner.runPythonCode(c),
                
                // Generic Bot Call (This handles dump, details, send, etc.)
                BotGeneric: async (method, ...args) => {
                    if (env.Bot[method]) return await env.Bot[method](...args);
                    throw new Error(`Method '${method}' not found`);
                }
            };

            const rules = [
                // 1. Data Operations
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },

                // 2. Wait / Sleep (e.g. Bot.sleep(5), wait(5))
                { r: /(Bot|bot|Api|api)\s*\.\s*(sleep|wait)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($3)' },
                { r: /(?<!\.)\b(sleep|wait)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($2)' },

                // 3. Ask / WaitForAnswer (e.g. Bot.ask("Hi"), ask("Hi"))
                { r: /(Bot|bot|Api|api)\s*\.\s*(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($3)' },
                { r: /(?<!\.)\b(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($2)' },

                // 4. Python
                { r: /runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.Python($1)' },

                // 5. Generic Bot Methods (send, dump, details, getUser, etc.)
                // These regexes catch ANY method called on Bot/Api that wasn't handled above
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|sleep|wait)([a-zA-Z0-9_]+)\s*\(\s*\)/g, 
                  to: "await __autoAwait.BotGeneric('$2')" },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|sleep|wait)([a-zA-Z0-9_]+)\s*\(/g, 
                  to: "await __autoAwait.BotGeneric('$2', " }
            ];

            let processedCode = userCode;
            // Apply all regex rules
            rules.forEach(rule => { processedCode = processedCode.replace(rule.r, rule.to); });

            // Execute in safe scope
            const run = new Function('env', `
                with(env) {
                    return (async function() {
                        try {
                            ${processedCode}
                        } catch(e) { throw e; }
                    })();
                }
            `);
            
            return await run({ ...env, __autoAwait });
        };

        // EXECUTE
        return await executeWithAutoAwait(code, envObject);

    } catch (error) {
        console.error('Command Exec Error:', error);
        throw error;
    } finally {
        try {
            await supabase.from('active_sessions').delete().eq('session_id', sessionKey);
        } catch (e) { /* ignore cleanup error */ }
    }
}

module.exports = { executeCommandCode };