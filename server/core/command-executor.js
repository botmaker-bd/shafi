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

        // ✅ REMOVED: waitForAnswerLogic from here (moved to ApiWrapper only)

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
            ...botDataFunctions
        };

        // ✅ FIXED: Clean environment - ONLY Bot object has all functions
        const baseExecutionEnv = {
            // Bot objects - সব ফাংশন এখানে
            Bot: botObject, 
            bot: botObject, 
            Api: botObject, 
            api: botObject,
            
            // User data functions
            User: userDataFunctions,
            
            // Message context (read only)
            msg, 
            chatId, 
            userId,
            chat: msg?.chat,
            
            // ✅ ONLY getUser function (no conflict)
            getUser: getUserFunction,
            
            // Input data (read only)
            userInput,
            params,
            text: userInput,
            
            // ✅ REMOVED: wait, sleep, runPython, ask, waitForAnswer from here
            // ✅ REMOVED: log, debug, error from here  
            // ✅ REMOVED: formatDate, formatTime, random, etc from here
            
            // ✅ KEPT ONLY: Essential context and getUser
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
                BotGeneric: async (method, ...args) => {
                    return await dynamicBotCaller(method, ...args);
                },
                BotInspect: async (target, options) => await env.bot.inspect(target, options),
                BotGetInfo: async (target) => await env.bot.getInfo(target),
                BotDetails: async (target) => await env.bot.details(target),
                BotAsk: async (q, o) => await env.bot.ask(q, o),
                BotWaitForAnswer: async (q, o) => await env.bot.waitForAnswer(q, o),
                BotRunPython: async (c) => await env.bot.runPython(c),
                BotWait: async (ms) => await env.bot.wait(ms),
                BotSleep: async (ms) => await env.bot.sleep(ms),
                BotDelay: async (ms) => await env.bot.delay(ms)
            };

            const rules = [
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                
                // ✅ FIXED: Bot object methods only
                { r: /(Bot|bot)\s*\.\s*ask\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotAsk($2)' },
                { r: /(Bot|bot)\s*\.\s*waitForAnswer\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotWaitForAnswer($2)' },
                { r: /(Bot|bot)\s*\.\s*runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotRunPython($1)' },
                { r: /(Bot|bot)\s*\.\s*wait\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotWait($2)' },
                { r: /(Bot|bot)\s*\.\s*sleep\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotSleep($2)' },
                { r: /(Bot|bot)\s*\.\s*delay\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDelay($2)' },
                { r: /(Bot|bot)\s*\.\s*inspect\s*\(([^)]*)\)/g, to: 'await __autoAwait.BotInspect($2)' },
                { r: /(Bot|bot)\s*\.\s*getInfo\s*\(([^)]*)\)/g, to: 'await __autoAwait.BotGetInfo($2)' },
                { r: /(Bot|bot)\s*\.\s*details\s*\(([^)]*)\)/g, to: 'await __autoAwait.BotDetails($2)' },
                
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|runPython|inspect|getInfo|details|wait|sleep|delay)([a-zA-Z0-9_]+)\s*\(\s*\)/g, 
                  to: "await __autoAwait.BotGeneric('$2')" },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer|runPython|inspect|getInfo|details|wait|sleep|delay)([a-zA-Z0-9_]+)\s*\(/g, 
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