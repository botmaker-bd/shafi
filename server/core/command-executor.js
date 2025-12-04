const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');

async function executeCommandCode(botInstance, code, context) {
    const msg = context.msg || context;
    const userId = context.userId || msg?.from?.id;
    const botToken = context.botToken || '';
    const userInput = context.userInput || msg?.text || msg?.caption || '';
    const params = context.params || '';
    const chatId = context.chatId || msg?.chat?.id;
    const nextCommandHandlers = context.nextCommandHandlers || new Map();
    
    if (!chatId) throw new Error("CRITICAL: Chat ID is missing!");
    
    const sessionKey = `sess_${userId}_${Date.now()}`;
    let resolvedBotToken = botToken;
    
    if (!resolvedBotToken) {
        try { 
            const i = await botInstance.getMe(); 
            resolvedBotToken = i.token; 
        } catch (e) { 
            resolvedBotToken = 'fallback_token'; 
        }
    }

    try {
        // Session logging
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

        // DATA FUNCTIONS
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

        // ✅ FIXED: WAIT FOR ANSWER LOGIC (MUST MATCH api-wrapper.js)
        const waitForAnswerLogic = async (question, options = {}) => {
            return new Promise((resolveWait, rejectWait) => {
                const waitKey = `${resolvedBotToken}_${userId}`;
                
                botInstance.sendMessage(chatId, question, options).then(() => {
                    const timeout = setTimeout(() => {
                        if (nextCommandHandlers?.has(waitKey)) {
                            nextCommandHandlers.delete(waitKey);
                            rejectWait(new Error('Timeout: User took too long to respond.'));
                        }
                    }, 5 * 60 * 1000);

                    if (nextCommandHandlers) {
                        nextCommandHandlers.set(waitKey, {
                            resolve: (ans) => { clearTimeout(timeout); resolveWait(ans); },
                            reject: (err) => { clearTimeout(timeout); rejectWait(err); },
                            timestamp: Date.now()
                        });
                    } else {
                        clearTimeout(timeout);
                        rejectWait(new Error('Handler system error'));
                    }
                }).catch(e => rejectWait(e));
            });
        };

        // SMART BOT WRAPPER
        const isChatId = (val) => {
            if (!val) return false;
            if (typeof val === 'number') return Number.isInteger(val) && Math.abs(val) > 200;
            if (typeof val === 'string') return val.startsWith('@') || /^-?\d+$/.test(val);
            return false;
        };

        const dynamicBotCaller = async (methodName, ...args) => {
            if (typeof botInstance[methodName] !== 'function') {
                throw new Error(`Method '${methodName}' missing in API`);
            }
            const noChatIdMethods = ['getMe', 'getWebhookInfo', 'deleteWebhook', 'setWebhook', 'answerCallbackQuery', 'answerInlineQuery', 'stopPoll', 'downloadFile', 'logOut', 'close'];

            if (!noChatIdMethods.includes(methodName)) {
                let shouldInject = false;
                if (methodName === 'sendLocation') {
                    if (args.length === 2 || (args.length === 3 && typeof args[2] === 'object')) shouldInject = true;
                } else if (methodName === 'sendMediaGroup') {
                    if (Array.isArray(args[0])) shouldInject = true;
                } else {
                    if (args.length === 0 || !isChatId(args[0])) {
                        if (methodName.startsWith('send') || methodName.startsWith('forward') || methodName.startsWith('copy')) shouldInject = true;
                    }
                }
                if (shouldInject) args.unshift(chatId);
            }
            return await botInstance[methodName](...args);
        };

        // ENVIRONMENT SETUP
        const apiCtx = { 
            msg, chatId, userId, botToken: resolvedBotToken, 
            userInput, params, nextCommandHandlers,
            // ✅ ask function pass করছি (api-wrapper কে ব্যবহার করার জন্য)
            ask: waitForAnswerLogic,
            waitForAnswer: waitForAnswerLogic
        };
        
        const apiWrapperInstance = new ApiWrapper(botInstance, apiCtx);
        
        // ✅ FIXED: Don't duplicate ask/waitForAnswer methods
        const botObject = { 
            ...apiWrapperInstance,  // ইতিমধ্যে ask/waitForAnswer আছে
            ...botDataFunctions
            // ask/waitForAnswer সরিয়ে দিয়েছি (apiWrapper থেকে আসবে)
        };

        const baseExecutionEnv = {
            Bot: botObject, 
            bot: botObject, 
            Api: botObject, 
            api: botObject,
            User: userDataFunctions,
            msg, 
            chatId, 
            userId,
            userInput,
            params,
            currentUser: msg.from || { id: userId, first_name: 'User' },
            wait: (ms) => new Promise(r => setTimeout(r, ms)),
            sleep: (ms) => new Promise(r => setTimeout(r, ms)),
            runPython: async (c) => await pythonRunner.runPythonCode(c),
            // ✅ Global ask/waitForAnswer functions
            ask: waitForAnswerLogic,
            waitForAnswer: waitForAnswerLogic
        };

        // AUTO-AWAIT ENGINE
        const executeWithAutoAwait = async (userCode, env) => {
            const __autoAwait = {
                UserSave: async (k, v) => await env.User.saveData(k, v),
                UserGet: async (k) => await env.User.getData(k),
                UserDel: async (k) => await env.User.deleteData(k),
                BotDataSave: async (k, v) => await env.bot.saveData(k, v),
                BotDataGet: async (k) => await env.bot.getData(k),
                BotDataDel: async (k) => await env.bot.deleteData(k),
                Ask: async (q, o) => await env.ask(q, o),
                Wait: async (ms) => await env.wait(ms),
                Sleep: async (ms) => await env.sleep(ms),
                Python: async (c) => {  
                    return await pythonRunner.runPythonCode(c);
                },
                BotGeneric: async (method, ...args) => {
                    // ✅ send/reply handle করি (api-wrapper এ আছে)
                    if (method === 'send' || method === 'reply') {
                        return await env.bot[method](...args);
                    }
                    // ✅ ask/waitForAnswer handle করি
                    if (method === 'ask' || method === 'waitForAnswer') {
                        return await env.ask(...args);
                    }
                    // ✅ runPython handle করি (api-wrapper এ আছে)
                    if (method === 'runPython') {
                        return await env.bot.runPython(...args);
                    }
                    // ✅ অন্যান্য methods
                    return await dynamicBotCaller(method, ...args);
                }
            };

            const rules = [
                // User methods
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                
                // Bot data methods
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                
                // Global ask/waitForAnswer
                { r: /(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($2)' },
                
                // ✅ FIXED: Bot.ask(), bot.ask(), Api.ask(), api.ask()
                { r: /(Bot|bot|Api|api)\s*\.\s*(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotGeneric(\'$2\', $3)' },
                
                // ✅ Bot.send(), bot.send(), etc (api-wrapper এ আছে)
                { r: /(Bot|bot|Api|api)\s*\.\s*(send|reply)\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotGeneric(\'$2\', $3)' },
                
                // ✅ Bot.runPython(), etc
                { r: /(Bot|bot|Api|api)\s*\.\s*runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotGeneric(\'runPython\', $2)' },
                
                // Wait/sleep
                { r: /wait\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($1)' },
                { r: /sleep\s*\(([^)]+)\)/g, to: 'await __autoAwait.Sleep($1)' },
                
                // Global runPython
                { r: /runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.Python($1)' },
                
                // ✅ FIXED: Other bot methods (exclude list আপডেট)
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|send|reply|runPython)([a-zA-Z0-9_]+)\s*\(\s*\)/g, 
                  to: "await __autoAwait.BotGeneric('$2')" },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|send|reply|runPython)([a-zA-Z0-9_]+)\s*\(/g, 
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
        } catch (e) { /* ignore cleanup error */ }
    }
}

console.log('✅ command-executor.js loaded successfully');
module.exports = { executeCommandCode };