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
    
    if (!chatId) {
        throw new Error("CRITICAL: Chat ID is missing in context!");
    }
    
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

        // User data functions
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
            },
            increment: async (key, amount = 1) => {
                const current = await userDataFunctions.getData(key) || 0;
                const newValue = parseInt(current) + amount;
                await userDataFunctions.saveData(key, newValue);
                return newValue;
            }
        };

        // Bot data functions
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

        // ✅ FIXED: waitForAnswer function (only in bot object, not global)
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

        // Bot wrapper
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

        // Environment setup
        const apiCtx = { 
            msg, 
            chatId, 
            userId, 
            botToken: resolvedBotToken, 
            userInput, 
            params,
            nextCommandHandlers 
        };
        
        const apiWrapperInstance = new ApiWrapper(botInstance, apiCtx);
        
        // ✅ FIXED: getUser function - returns string when used as string
        const getUserFunction = () => {
            if (msg?.from) {
                const userObj = {
                    id: msg.from.id,
                    username: msg.from.username || '',
                    first_name: msg.from.first_name,
                    last_name: msg.from.last_name || '',
                    language_code: msg.from.language_code || 'en',
                    is_bot: msg.from.is_bot || false,
                    chat_id: chatId
                };
                
                // When called as function, return object
                // When converted to string, return name
                userObj.toString = function() {
                    if (this.first_name && this.last_name) {
                        return `${this.first_name} ${this.last_name}`;
                    }
                    return this.first_name || this.username || `User${this.id}`;
                };
                
                userObj.valueOf = function() {
                    return this.toString();
                };
                
                return userObj;
            }
            const fallbackObj = {
                id: userId,
                first_name: 'User',
                chat_id: chatId,
                toString: () => 'User',
                valueOf: () => 'User'
            };
            return fallbackObj;
        };

        const botObject = { 
            ...apiWrapperInstance, 
            ...botDataFunctions,
            
            // ✅ FIXED: Only Bot.ask and Bot.waitForAnswer (not global ask)
            ask: waitForAnswerLogic,
            waitForAnswer: waitForAnswerLogic,
            
            // ✅ FIXED: Python runner method
            runPython: async (code) => {
                try {
                    const result = await pythonRunner.runPythonCode(code);
                    return result;
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            },
            
            // ✅ FIXED: Inspection methods
            inspect: async (target = 'all', options = {}) => {
                try {
                    const result = await apiWrapperInstance.inspect(target, options);
                    return result;
                } catch (error) {
                    return { error: error.message };
                }
            },
            
            getInfo: async (target = 'all') => {
                try {
                    const result = await apiWrapperInstance.getInfo(target);
                    return result;
                } catch (error) {
                    return { error: error.message };
                }
            },
            
            details: async (target = 'all') => {
                try {
                    const result = await apiWrapperInstance.details(target);
                    return result;
                } catch (error) {
                    return { error: error.message };
                }
            }
        };

        // ✅ FIXED: Complete environment WITHOUT global ask function
        const baseExecutionEnv = {
            // Bot objects
            Bot: botObject, 
            bot: botObject, 
            Api: botObject, 
            api: botObject,
            
            // User data functions
            User: userDataFunctions,
            user: userDataFunctions, // alias
            
            // Message context
            msg, 
            message: msg, // alias
            chatId, 
            userId,
            chat: msg?.chat,
            
            // ✅ FIXED: getUser function that works with string conversion
            getUser: getUserFunction,
            
            // Input data
            userInput,
            params,
            text: userInput,
            
            // Wait functions
            wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            delay: (sec) => new Promise(r => setTimeout(r, sec * 1000)), // alias
            
            // Python - directly call pythonRunner
            runPython: async (code) => {
                try {
                    return await pythonRunner.runPythonCode(code);
                } catch (error) {
                    throw new Error(`Python Error: ${error.message}`);
                }
            },
            
            // ❌ REMOVED: Global ask function (only Bot.ask available)
            // No global 'ask' or 'waitForAnswer' here
            
            // Utility functions
            log: (...args) => console.log('[BOT LOG]:', ...args),
            debug: (...args) => console.log('[BOT DEBUG]:', ...args),
            error: (...args) => console.error('[BOT ERROR]:', ...args),
            
            // Formatting utilities
            formatDate: (date = new Date()) => date.toLocaleDateString(),
            formatTime: (date = new Date()) => date.toLocaleTimeString(),
            now: () => new Date(),
            
            // Random utilities
            random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
            randomChoice: (arr) => arr[Math.floor(Math.random() * arr.length)],
            
            // String utilities
            escapeHtml: (text) => String(text).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])),
            truncate: (text, length = 100) => text.length > length ? text.substring(0, length) + '...' : text,
            
            // Validation
            isNumber: (val) => !isNaN(parseFloat(val)) && isFinite(val),
            isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
            
            // JSON utilities
            toJson: (obj) => JSON.stringify(obj, null, 2),
            parseJson: (str) => JSON.parse(str),
            
            // ✅ NEW: Direct inspection methods
            inspect: async (target = 'all', options = {}) => {
                try {
                    return await botObject.inspect(target, options);
                } catch (error) {
                    return { error: error.message };
                }
            },
            
            getInfo: async (target = 'all') => {
                try {
                    return await botObject.getInfo(target);
                } catch (error) {
                    return { error: error.message };
                }
            }
        };

        // Auto-await engine
        const executeWithAutoAwait = async (userCode, env) => {
            const __autoAwait = {
                UserSave: async (k, v) => await env.User.saveData(k, v),
                UserGet: async (k) => await env.User.getData(k),
                UserDel: async (k) => await env.User.deleteData(k),
                BotDataSave: async (k, v) => await env.bot.saveData(k, v),
                BotDataGet: async (k) => await env.bot.getData(k),
                BotDataDel: async (k) => await env.bot.deleteData(k),
                Ask: async (q, o) => await env.bot.ask(q, o), // ✅ FIXED: Only bot.ask
                Wait: async (s) => await env.wait(s),
                Python: async (c) => {  
                    const result = await env.runPython(c);
                    return result;
                },
                BotGeneric: async (method, ...args) => {
                    return await dynamicBotCaller(method, ...args);
                },
                Inspect: async (target, options) => await env.bot.inspect(target, options),
                GetInfo: async (target) => await env.bot.getInfo(target),
                Details: async (target) => await env.bot.details(target)
            };

            const rules = [
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                { r: /(Bot|bot)\.(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($3)' }, // ✅ FIXED: Only Bot.ask
                { r: /(wait|sleep|delay)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($2)' },
                { r: /runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.Python($1)' },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|runPython|inspect|getInfo|details)([a-zA-Z0-9_]+)\s*\(\s*\)/g, 
                  to: "await __autoAwait.BotGeneric('$2')" },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|runPython|inspect|getInfo|details)([a-zA-Z0-9_]+)\s*\(/g, 
                  to: "await __autoAwait.BotGeneric('$2', " },
                { r: /(Bot|bot|Api|api)\s*\.\s*inspect\s*\(([^)]*)\)/g, to: 'await __autoAwait.Inspect($2)' },
                { r: /(Bot|bot|Api|api)\s*\.\s*getInfo\s*\(([^)]*)\)/g, to: 'await __autoAwait.GetInfo($2)' },
                { r: /(Bot|bot|Api|api)\s*\.\s*details\s*\(([^)]*)\)/g, to: 'await __autoAwait.Details($2)' }
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

        // Execute
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