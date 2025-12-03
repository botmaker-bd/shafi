const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');

async function executeCommandCode(botInstance, code, context) {
    // ✅ userInput সঠিকভাবে extract করুন
    const msg = context.msg || context;
    const userId = context.userId || msg?.from?.id;
    const botToken = context.botToken || context.command?.bot_token;
    
    // ✅ সম্পূর্ণ user input (কমান্ড সহ)
    const fullUserInput = context.userInput || 
                         msg?.text || 
                         msg?.caption || 
                         '';
    
    // ✅ COMMAND এবং PARAMS আলাদা করার লজিক
    let commandText = '';
    let params = '';
    const currentCommand = context.command;
    
    if (currentCommand && currentCommand.command_patterns && fullUserInput) {
        const patterns = currentCommand.command_patterns.split(',').map(p => p.trim());
        
        for (const pattern of patterns) {
            // Exact match
            if (fullUserInput === pattern) {
                commandText = pattern;
                params = '';
                break;
            }
            
            // Pattern দিয়ে শুরু হলে
            if (fullUserInput.startsWith(pattern + ' ')) {
                commandText = pattern;
                params = fullUserInput.substring(pattern.length).trim();
                break;
            }
            
            // Alternative: slash ছাড়া pattern
            if (!pattern.startsWith('/') && fullUserInput.startsWith('/' + pattern)) {
                const patternWithSlash = '/' + pattern;
                if (fullUserInput === patternWithSlash || fullUserInput.startsWith(patternWithSlash + ' ')) {
                    commandText = patternWithSlash;
                    params = fullUserInput.substring(patternWithSlash.length).trim();
                    break;
                }
            }
        }
        
        // যদি কোনো match না পাওয়া যায়, default হিসেবে
        if (!commandText && patterns.length > 0) {
            commandText = patterns[0];
            params = fullUserInput;
        }
    }
    
    const chatId = context.chatId || msg?.chat?.id;
    const nextCommandHandlers = context.nextCommandHandlers || new Map();
    
    // ✅ ডিবাগ লগ
    console.log(`🔍 EXECUTOR DEBUG:`);
    console.log(`  - Full Input: "${fullUserInput}"`);
    console.log(`  - Command Found: "${commandText}"`);
    console.log(`  - Params Extracted: "${params}"`);
    console.log(`  - Command Patterns: "${currentCommand?.command_patterns}"`);
    
    if (!chatId) {
        throw new Error("CRITICAL: Chat ID is missing in context!");
    }
    
    const sessionKey = `sess_${userId}_${Date.now()}`;
    
    // --- বাকি কোড একই থাকবে ---
    let resolvedBotToken = botToken;
    if (!resolvedBotToken && context.command) resolvedBotToken = context.command.bot_token;
    
    if (!resolvedBotToken) {
        try { 
            const i = await botInstance.getMe(); 
            resolvedBotToken = i.token; 
        } catch (e) { 
            resolvedBotToken = 'fallback_token'; 
        }
    }

    try {
        // SESSION START
        try {
            await supabase.from('active_sessions').insert({
                session_id: sessionKey, 
                bot_token: resolvedBotToken, 
                user_id: userId.toString(),
                chat_id: chatId, 
                started_at: new Date().toISOString()
            });
        } catch (sessionErr) {
            console.warn("⚠️ Session logging failed:", sessionErr.message);
        }

        // DATA FUNCTIONS (same as before)
        const userDataFunctions = {
            saveData: async (key, value) => {
                const { error } = await supabase.from('universal_data').upsert({
                    data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(),
                    data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString()
                }, { onConflict: 'data_type,bot_token,user_id,data_key' });
                if (error) throw new Error(`User.saveData failed: ${error.message}`);
                return value;
            },
            getData: async (key) => {
                const { data, error } = await supabase.from('universal_data').select('data_value')
                    .match({ data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(), data_key: key })
                    .maybeSingle();
                if (error) throw new Error(`User.getData failed: ${error.message}`);
                try { return data ? JSON.parse(data.data_value) : null; } catch { return data?.data_value; }
            },
            deleteData: async (key) => {
                const { error } = await supabase.from('universal_data').delete()
                    .match({ data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(), data_key: key });
                if (error) throw new Error(`User.deleteData failed: ${error.message}`);
                return true;
            }
        };

        const botDataFunctions = {
            saveData: async (key, value) => {
                const { data: exist } = await supabase.from('universal_data').select('id')
                    .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key }).maybeSingle();
                
                const payload = { 
                    data_type: 'bot_data', bot_token: resolvedBotToken, 
                    data_key: key, data_value: JSON.stringify(value), 
                    updated_at: new Date().toISOString() 
                };

                let error;
                if (exist) {
                    ({ error } = await supabase.from('universal_data').update(payload).eq('id', exist.id));
                } else {
                    ({ error } = await supabase.from('universal_data').insert({ ...payload, created_at: new Date().toISOString() }));
                }
                if (error) throw new Error(`Bot.saveData failed: ${error.message}`);
                return value;
            },
            getData: async (key) => {
                const { data, error } = await supabase.from('universal_data').select('data_value')
                    .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key }).maybeSingle();
                if (error) throw new Error(`Bot.getData failed: ${error.message}`);
                try { return data ? JSON.parse(data.data_value) : null; } catch { return data?.data_value; }
            },
            deleteData: async (key) => {
                const { error } = await supabase.from('universal_data').delete()
                    .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key });
                if (error) throw new Error(`Bot.deleteData failed: ${error.message}`);
                return true;
            }
        };

        // ENVIRONMENT SETUP
        const apiCtx = { 
            msg, 
            chatId, 
            userId, 
            botToken: resolvedBotToken, 
            userInput: fullUserInput, 
            command: commandText,
            params: params,
            nextCommandHandlers 
        };
        
        const apiWrapperInstance = new ApiWrapper(botInstance, apiCtx);
        const botObject = { ...apiWrapperInstance, ...botDataFunctions };

        // ENVIRONMENT SETUP এর এই অংশটি
const baseExecutionEnv = {
    Bot: botObject, 
    bot: botObject,  // ✅ এই bot variable টি user code এ available হবে
    Api: botObject, 
    api: botObject,
    User: userDataFunctions,
    msg, 
    chatId, 
    userId,
    userInput: fullUserInput,    // ✅ সম্পূর্ণ input (কমান্ড সহ)
    command: commandText,         // ✅ শুধুমাত্র কমান্ড অংশ
    params: params,               // ✅ শুধুমাত্র প্যারামিটার অংশ
    currentUser: msg.from || { id: userId, first_name: context.first_name || 'User' },
    wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
    sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
    runPython: (c) => pythonRunner.runPythonCodeSync(c),
    ask: (q, o) => {
        return new Promise((resolveAsk, rejectAsk) => {
            const waitKey = `${resolvedBotToken}_${userId}_ask`;
            botInstance.sendMessage(chatId, q, o).then(() => {
                const timeout = setTimeout(() => {
                    if (nextCommandHandlers?.has(waitKey)) {
                        nextCommandHandlers.delete(waitKey);
                        rejectAsk(new Error('Timeout'));
                    }
                }, 5 * 60 * 1000);

                if (nextCommandHandlers) {
                    nextCommandHandlers.set(waitKey, {
                        resolve: resolveAsk,
                        reject: rejectAsk,
                        timestamp: Date.now()
                    });
                } else {
                    clearTimeout(timeout);
                    rejectAsk(new Error('Handler error'));
                }
            }).catch(rejectAsk);
        });
    },
    waitForAnswer: (q, o) => baseExecutionEnv.ask(q, o)
};

        // AUTO-AWAIT ENGINE (same as before)
        const executeWithAutoAwait = async (userCode, env) => {
            const __autoAwait = {
                UserSave: async (k, v) => await env.User.saveData(k, v),
                UserGet: async (k) => await env.User.getData(k),
                UserDel: async (k) => await env.User.deleteData(k),
                BotDataSave: async (k, v) => await env.bot.saveData(k, v),
                BotDataGet: async (k) => await env.bot.getData(k),
                BotDataDel: async (k) => await env.bot.deleteData(k),
                Ask: async (q, o) => await env.ask(q, o),
                Wait: async (s) => await env.wait(s),
                Python: async (c) => {  
                    const result = await pythonRunner.runPythonCode(c);
                    return result;
                },
                BotGeneric: async (method, ...args) => {
                    if (typeof botInstance[method] !== 'function') {
                        throw new Error(`Method '${method}' missing in API`);
                    }
                    return await botInstance[method](...args);
                }
            };

            const rules = [
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                { r: /(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($2)' },
                { r: /(wait|sleep)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($2)' },
                { r: /runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.Python($1)' },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer)([a-zA-Z0-9_]+)\s*\(\s*\)/g, 
                  to: "await __autoAwait.BotGeneric('$2')" },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer)([a-zA-Z0-9_]+)\s*\(/g, 
                  to: "await __autoAwait.BotGeneric('$2', " }
            ];

            const enhancedEnv = { ...env, __autoAwait };
            let processedCode = userCode;

            rules.forEach(rule => { 
                processedCode = processedCode.replace(rule.r, rule.to); 
            });

            const finalCode = `
                try {
                    ${processedCode}
                } catch (error) {
                    throw error;
                }
            `;

            const run = new Function('env', `
                with(env) {
                    return (async function() {
                        ${finalCode}
                    })();
                }
            `);
            
            return await run(enhancedEnv);
        };

        // EXECUTE
        return await executeWithAutoAwait(code, baseExecutionEnv);

    } catch (error) {
        console.error('💥 Execution Error:', error);
        
        if (error.name === 'AggregateError') {
            console.error('🔍 Aggregate Errors:', error.errors);
            throw new Error(`Connection Error: ${error.errors[0]?.message || 'Check Network/Supabase'}`);
        }

        throw error;
    } finally {
        try {
            await supabase.from('active_sessions').delete().eq('session_id', sessionKey);
        } catch (e) { /* ignore */ }
    }
}

module.exports = { executeCommandCode };