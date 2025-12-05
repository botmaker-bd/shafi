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

        // ✅ FIXED: waitForAnswer function
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
        const dynamicBotCaller = async (methodName, ...args) => {
            if (typeof botInstance[methodName] !== 'function') {
                throw new Error(`Method '${methodName}' missing in API`);
            }
            
            const noChatIdMethods = ['getMe', 'getWebhookInfo', 'deleteWebhook', 'setWebhook', 'answerCallbackQuery', 'answerInlineQuery', 'stopPoll', 'downloadFile', 'logOut', 'close'];
            
            let finalArgs = [...args];
            
            if (!noChatIdMethods.includes(methodName)) {
                const chatIdMethods = ['sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo', 'sendAudio', 'sendVoice', 'sendLocation', 'sendVenue', 'sendContact', 'sendPoll', 'sendDice', 'sendChatAction', 'sendMediaGroup', 'forwardMessage', 'copyMessage', 'deleteMessage', 'getChat', 'getChatAdministrators', 'getChatMemberCount', 'getChatMember', 'setChatTitle', 'setChatDescription', 'setChatPhoto', 'deleteChatPhoto', 'pinChatMessage', 'unpinChatMessage', 'leaveChat', 'sendSticker', 'createForumTopic'];
                
                if (chatIdMethods.includes(methodName)) {
                    if (finalArgs.length === 0 || (typeof finalArgs[0] !== 'number' && !finalArgs[0]?.toString().startsWith('@') && !finalArgs[0]?.toString().startsWith('-'))) {
                        finalArgs.unshift(chatId);
                    }
                }
            }
            
            return await botInstance[methodName](...finalArgs);
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
        
        // ✅ Create Bot object with specific methods
        const botObject = { 
            // Telegram API methods
            sendMessage: (...args) => dynamicBotCaller('sendMessage', ...args),
            sendPhoto: (...args) => dynamicBotCaller('sendPhoto', ...args),
            sendDocument: (...args) => dynamicBotCaller('sendDocument', ...args),
            sendVideo: (...args) => dynamicBotCaller('sendVideo', ...args),
            sendAudio: (...args) => dynamicBotCaller('sendAudio', ...args),
            sendVoice: (...args) => dynamicBotCaller('sendVoice', ...args),
            sendLocation: (...args) => dynamicBotCaller('sendLocation', ...args),
            sendContact: (...args) => dynamicBotCaller('sendContact', ...args),
            sendPoll: (...args) => dynamicBotCaller('sendPoll', ...args),
            sendChatAction: (...args) => dynamicBotCaller('sendChatAction', ...args),
            sendMediaGroup: (...args) => dynamicBotCaller('sendMediaGroup', ...args),
            forwardMessage: (...args) => dynamicBotCaller('forwardMessage', ...args),
            copyMessage: (...args) => dynamicBotCaller('copyMessage', ...args),
            deleteMessage: (...args) => dynamicBotCaller('deleteMessage', ...args),
            getChat: (...args) => dynamicBotCaller('getChat', ...args),
            getChatAdministrators: (...args) => dynamicBotCaller('getChatAdministrators', ...args),
            getChatMember: (...args) => dynamicBotCaller('getChatMember', ...args),
            getChatMemberCount: (...args) => dynamicBotCaller('getChatMemberCount', ...args),
            setChatTitle: (...args) => dynamicBotCaller('setChatTitle', ...args),
            setChatDescription: (...args) => dynamicBotCaller('setChatDescription', ...args),
            pinChatMessage: (...args) => dynamicBotCaller('pinChatMessage', ...args),
            unpinChatMessage: (...args) => dynamicBotCaller('unpinChatMessage', ...args),
            leaveChat: (...args) => dynamicBotCaller('leaveChat', ...args),
            sendSticker: (...args) => dynamicBotCaller('sendSticker', ...args),
            
            // Bot info methods
            getMe: () => dynamicBotCaller('getMe'),
            getWebhookInfo: () => dynamicBotCaller('getWebhookInfo'),
            
            // Callback and inline
            answerCallbackQuery: (...args) => dynamicBotCaller('answerCallbackQuery', ...args),
            answerInlineQuery: (...args) => dynamicBotCaller('answerInlineQuery', ...args),
            
            // File methods
            getFile: (...args) => dynamicBotCaller('getFile', ...args),
            
            // ✅ NEW: Unified inspect method
            inspect: async (type = 'all') => {
                try {
                    const types = {
                        user: async () => {
                            if (msg?.from) {
                                return msg.from;
                            }
                            return { id: userId, note: 'User from context' };
                        },
                        chat: async () => await dynamicBotCaller('getChat', chatId),
                        bot: async () => await dynamicBotCaller('getMe'),
                        update: async () => msg || context,
                        message: async () => msg,
                        call: async () => ({ note: 'Call data not available in this context' }),
                        response: async () => ({ note: 'Response data not available' }),
                        all: async () => {
                            const [botInfo, chatInfo] = await Promise.all([
                                dynamicBotCaller('getMe'),
                                dynamicBotCaller('getChat', chatId).catch(() => null)
                            ]);
                            return {
                                bot: botInfo,
                                chat: chatInfo,
                                user: msg?.from || { id: userId },
                                message: msg,
                                context: {
                                    chatId,
                                    userId,
                                    userInput,
                                    params
                                },
                                timestamp: new Date().toISOString()
                            };
                        }
                    };

                    const handler = types[type.toLowerCase()] || types.all;
                    const result = await handler();
                    
                    return {
                        success: true,
                        type: type,
                        data: result,
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    return {
                        success: false,
                        type: type,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    };
                }
            },
            
            // ✅ NEW: getInfo method
            getInfo: async (target = null) => {
                try {
                    if (target) {
                        // Specific target
                        if (target.startsWith('@')) {
                            // Username
                            return {
                                success: true,
                                type: 'username',
                                username: target.substring(1),
                                note: 'Username lookup not implemented'
                            };
                        } else if (!isNaN(target)) {
                            const id = parseInt(target);
                            if (id > 0) {
                                // User ID
                                try {
                                    const member = await dynamicBotCaller('getChatMember', chatId, id);
                                    return {
                                        success: true,
                                        type: 'user',
                                        data: member
                                    };
                                } catch {
                                    return {
                                        success: true,
                                        type: 'user',
                                        id: id,
                                        note: 'Could not fetch user details'
                                    };
                                }
                            } else {
                                // Chat ID
                                try {
                                    const chat = await dynamicBotCaller('getChat', id);
                                    return {
                                        success: true,
                                        type: 'chat',
                                        data: chat
                                    };
                                } catch {
                                    return {
                                        success: true,
                                        type: 'chat',
                                        id: id,
                                        note: 'Could not fetch chat details'
                                    };
                                }
                            }
                        }
                    }
                    
                    // Default: get everything
                    const [botInfo, chatInfo] = await Promise.all([
                        dynamicBotCaller('getMe'),
                        dynamicBotCaller('getChat', chatId).catch(() => null)
                    ]);
                    
                    return {
                        success: true,
                        data: {
                            bot: botInfo,
                            chat: chatInfo,
                            user: msg?.from || { id: userId },
                            message: msg,
                            context: {
                                chatId,
                                userId,
                                userInput,
                                params
                            }
                        },
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        timestamp: new Date().toISOString()
                    };
                }
            },
            
            // ✅ NEW: details method (alias for getInfo)
            details: async (target = null) => {
                return await botObject.getInfo(target);
            },
            
            // Bot data methods
            ...botDataFunctions,
            
            // ✅ REMOVED: ask/waitForAnswer from Bot object (to avoid conflict)
            // User should use the global waitForAnswer function instead
        };

        // Create Api object (same as Bot)
        const apiObject = {
            ...botObject,
            // Api-specific methods can be added here
        };

        // ✅ FIXED: Complete environment WITHOUT conflicting functions
        const baseExecutionEnv = {
            // Bot and Api objects
            Bot: botObject,
            bot: botObject,
            Api: apiObject,
            api: apiObject,
            
            // User data functions
            User: userDataFunctions,
            
            // Message context
            msg,
            message: msg,
            chatId,
            userId,
            chat: msg?.chat,
            
            // User info - ✅ FIXED: getUser function
            getUser: () => {
                if (msg?.from) {
                    return {
                        id: msg.from.id,
                        username: msg.from.username || '',
                        first_name: msg.from.first_name,
                        last_name: msg.from.last_name || '',
                        language_code: msg.from.language_code || 'en',
                        is_bot: msg.from.is_bot || false,
                        chat_id: chatId
                    };
                }
                return {
                    id: userId,
                    first_name: 'User',
                    chat_id: chatId
                };
            },
            
            // ✅ FIXED: waitForAnswer function (global, not on Bot)
            waitForAnswer: waitForAnswerLogic,
            
            // Input data
            userInput,
            params,
            text: userInput,
            
            // ✅ REMOVED: wait, sleep, runPython from environment (to avoid confusion)
            // Users should use Bot methods or specific functions
            
            // Python execution through Bot object only
            // runPython is available as Bot.runPython()
            
            // Utility functions (safe ones)
            formatDate: (date = new Date()) => date.toLocaleDateString(),
            formatTime: (date = new Date()) => date.toLocaleTimeString(),
            now: () => new Date(),
            
            // String utilities
            escapeHtml: (text) => String(text).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])),
            truncate: (text, length = 100) => text.length > length ? text.substring(0, length) + '...' : text,
            
            // Validation
            isNumber: (val) => !isNaN(parseFloat(val)) && isFinite(val),
            isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        };

        // Auto-await engine
        const executeWithAutoAwait = async (userCode, env) => {
            const __autoAwait = {
                // User data
                UserSave: async (k, v) => await env.User.saveData(k, v),
                UserGet: async (k) => await env.User.getData(k),
                UserDel: async (k) => await env.User.deleteData(k),
                
                // Bot data
                BotDataSave: async (k, v) => await env.bot.saveData(k, v),
                BotDataGet: async (k) => await env.bot.getData(k),
                BotDataDel: async (k) => await env.bot.deleteData(k),
                
                // Wait for answer
                WaitForAnswer: async (q, o) => await env.waitForAnswer(q, o),
                
                // Bot methods
                BotInspect: async (type) => await env.bot.inspect(type),
                BotGetInfo: async (target) => await env.bot.getInfo(target),
                BotDetails: async (target) => await env.bot.details(target),
                BotGetMe: async () => await env.bot.getMe(),
                BotGetChat: async (id) => await env.bot.getChat(id),
                
                // Python through Bot
                BotRunPython: async (code) => {
                    const pythonRunner = require('./python-runner');
                    return await pythonRunner.runPythonCode(code);
                },
                
                // Generic Bot methods
                BotGeneric: async (method, ...args) => {
                    if (typeof env.bot[method] !== 'function') {
                        throw new Error(`Bot method '${method}' not found`);
                    }
                    return await env.bot[method](...args);
                }
            };

            const rules = [
                // User data
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                
                // Bot data
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                
                // Wait for answer
                { r: /waitForAnswer\s*\(([^)]+)\)/g, to: 'await __autoAwait.WaitForAnswer($1)' },
                
                // Bot inspection methods
                { r: /(Bot|bot)\s*\.\s*inspect\s*\(([^)]*)\)/g, to: 'await __autoAwait.BotInspect($2)' },
                { r: /(Bot|bot)\s*\.\s*getInfo\s*\(([^)]*)\)/g, to: 'await __autoAwait.BotGetInfo($2)' },
                { r: /(Bot|bot)\s*\.\s*details\s*\(([^)]*)\)/g, to: 'await __autoAwait.BotDetails($2)' },
                { r: /(Bot|bot)\s*\.\s*getMe\s*\(\s*\)/g, to: 'await __autoAwait.BotGetMe()' },
                { r: /(Bot|bot)\s*\.\s*getChat\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotGetChat($1)' },
                
                // Python through Bot
                { r: /(Bot|bot)\s*\.\s*runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotRunPython($2)' },
                
                // Generic Bot methods (for sendMessage, sendPhoto, etc.)
                { r: /(Bot|bot)\s*\.\s*(?!saveData|getData|deleteData|inspect|getInfo|details|getMe|getChat|runPython)([a-zA-Z0-9_]+)\s*\(\s*\)/g, 
                  to: "await __autoAwait.BotGeneric('$2')" },
                { r: /(Bot|bot)\s*\.\s*(?!saveData|getData|deleteData|inspect|getInfo|details|getMe|getChat|runPython)([a-zA-Z0-9_]+)\s*\(/g, 
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