// server/core/command-executor.js - COMPLETELY FIXED
const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');

async function executeCommandCode(botInstance, code, context) {
    // ✅ Context থেকে ডাটা নিন
    const msg = context.msg || context;
    const userId = context.userId || msg?.from?.id;
    const botToken = context.botToken || '';
    
    // ✅ এই দুটি ভেরিয়েবল আলাদা আলাদাভাবে set করুন
    const userInput = context.userInput || msg?.text || msg?.caption || '';
    const params = context.params || '';
    
    const chatId = context.chatId || msg?.chat?.id;
    const nextCommandHandlers = context.nextCommandHandlers || new Map();
    
    if (!chatId) {
        throw new Error("CRITICAL: Chat ID is missing in context!");
    }
    
    const sessionKey = `sess_${userId}_${Date.now()}`;
    
    // --- 1. SETUP ---
    let resolvedBotToken = botToken;
    
    // Token Fallback - সরাসরি botInstance থেকে নিন
    if (!resolvedBotToken) {
        try { 
            const i = await botInstance.getMe(); 
            resolvedBotToken = i.token; 
        } catch (e) { 
            resolvedBotToken = 'fallback_token'; 
        }
    }

    try {
        // --- 2. SESSION START ---
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

        // --- 3. DATA FUNCTIONS ---
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

        // --- 4. INTERACTION ---
        const waitForAnswerLogic = async (question, options = {}) => {
            return new Promise((resolveWait, rejectWait) => {
                const waitKey = `${resolvedBotToken}_${userId}`;
                
                botInstance.sendMessage(chatId, question, options).then(() => {
                    const timeout = setTimeout(() => {
                        if (nextCommandHandlers?.has(waitKey)) {
                            nextCommandHandlers.delete(waitKey);
                            rejectWait(new Error('Timeout: User took too long to respond.'));
                        }
                    }, 5 * 60 * 1000); // 5 Minutes

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

        // --- 5. SMART BOT WRAPPER ---
        const isChatId = (val) => {
            if (!val) return false;
            if (typeof val === 'number') return Number.isInteger(val) && Math.abs(val) > 200;
            if (typeof val === 'string') return val.startsWith('@') || /^-?\d+$/.test(val);
            return false;
        };

        const dynamicBotCaller = async (methodName, ...args) => {
            if (typeof botInstance[methodName] !== 'function') {
                console.warn(`⚠️ Method '${methodName}' not available in bot instance`);
                throw new Error(`Method '${methodName}' not available`);
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
            
            try {
                return await botInstance[methodName](...args);
            } catch (error) {
                console.error(`❌ Bot API error (${methodName}):`, error.message);
                throw new Error(`Bot API Error (${methodName}): ${error.message}`);
            }
        };

        // --- 6. ENVIRONMENT SETUP ---
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
        const botObject = { ...apiWrapperInstance, ...botDataFunctions };

        const baseExecutionEnv = {
            Bot: botObject, 
            bot: botObject, 
            Api: botObject, 
            api: botObject,
            User: userDataFunctions,
            msg, 
            chatId, 
            userId,
            userInput,      // ✅ সম্পূর্ণ user input
            params,         // ✅ শুধুমাত্র কমান্ডের পরের অংশ
            currentUser: msg.from || { id: userId, first_name: 'User' },
            wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            runPython: (code) => {
                try {
                    // ✅ FIXED: Python execution with proper error handling
                    return pythonRunner.runPythonCodeSync(code);
                } catch (pythonError) {
                    // ✅ Telegram-safe error message
                    let errorMsg = pythonError.message || 'Python execution failed';
                    
                    // Escape Markdown characters for Telegram
                    errorMsg = errorMsg
                        .replace(/\*/g, '\\*')
                        .replace(/_/g, '\\_')
                        .replace(/`/g, '\\`')
                        .replace(/\[/g, '\\[')
                        .replace(/\]/g, '\\]')
                        .replace(/\(/g, '\\(')
                        .replace(/\)/g, '\\)')
                        .replace(/~/g, '\\~')
                        .replace(/>/g, '\\>')
                        .replace(/#/g, '\\#')
                        .replace(/\+/g, '\\+')
                        .replace(/-/g, '\\-')
                        .replace(/=/g, '\\=')
                        .replace(/\|/g, '\\|')
                        .replace(/\{/g, '\\{')
                        .replace(/\}/g, '\\}')
                        .replace(/\./g, '\\.')
                        .replace(/!/g, '\\!');
                    
                    throw new Error(`Python Error: ${errorMsg}`);
                }
            },
            ask: waitForAnswerLogic,
            waitForAnswer: waitForAnswerLogic
        };

        // --- 7. FIXED AUTO-AWAIT ENGINE ---
        const executeWithAutoAwait = async (userCode, env) => {
            // ✅ FIXED: Safe function creation without 'with' statement
            const createExecutionFunction = (codeToExecute, executionEnv) => {
                // Extract all keys from the environment
                const envKeys = Object.keys(executionEnv);
                const envValues = envKeys.map(key => executionEnv[key]);
                
                // Create parameter string for the function
                const paramString = envKeys.join(', ');
                
                // Create the function with explicit parameters
                const func = new Function(
                    paramString,
                    `
                    return (async function() {
                        try {
                            ${codeToExecute}
                        } catch (error) {
                            // ✅ Telegram-safe error messages
                            let errorMsg = error.message || 'Unknown error';
                            
                            // Escape Markdown characters
                            const markdownChars = ['*', '_', '\`', '[', ']', '(', ')', '~', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
                            for (const char of markdownChars) {
                                errorMsg = errorMsg.split(char).join('\\\\' + char);
                            }
                            
                            throw new Error(errorMsg);
                        }
                    })();
                    `
                );
                
                // Execute the function with all environment values
                return func(...envValues);
            };

            // ✅ FIXED: Auto-await rules
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
                    try {
                        const result = await pythonRunner.runPythonCode(c);
                        return result;
                    } catch (error) {
                        // Telegram-safe error message
                        let errorMsg = error.message || 'Python execution failed';
                        errorMsg = errorMsg.replace(/\*/g, '\\*').replace(/_/g, '\\_').replace(/`/g, '\\`');
                        throw new Error(`Python Error: ${errorMsg}`);
                    }
                },
                BotGeneric: async (method, ...args) => {
                    return await dynamicBotCaller(method, ...args);
                }
            };

            // ✅ FIXED: Enhanced environment
            const enhancedEnv = { 
                ...env, 
                __autoAwait,
                // Add auto-await helpers directly
                $saveData: __autoAwait.UserSave,
                $getData: __autoAwait.UserGet,
                $deleteData: __autoAwait.UserDel,
                $botSave: __autoAwait.BotDataSave,
                $botGet: __autoAwait.BotDataGet,
                $botDelete: __autoAwait.BotDataDel,
                $ask: __autoAwait.Ask,
                $wait: __autoAwait.Wait,
                $python: __autoAwait.Python,
                $botCall: __autoAwait.BotGeneric
            };

            // ✅ FIXED: Process code with auto-await
            let processedCode = userCode;
            
            // Convert async calls to use auto-await helpers
            processedCode = processedCode.replace(/User\.saveData\s*\(/g, '$saveData(');
            processedCode = processedCode.replace(/User\.getData\s*\(/g, '$getData(');
            processedCode = processedCode.replace(/User\.deleteData\s*\(/g, '$deleteData(');
            processedCode = processedCode.replace(/Bot\.saveData\s*\(/g, '$botSave(');
            processedCode = processedCode.replace(/Bot\.getData\s*\(/g, '$botGet(');
            processedCode = processedCode.replace(/Bot\.deleteData\s*\(/g, '$botDelete(');
            processedCode = processedCode.replace(/bot\.saveData\s*\(/g, '$botSave(');
            processedCode = processedCode.replace(/bot\.getData\s*\(/g, '$botGet(');
            processedCode = processedCode.replace(/bot\.deleteData\s*\(/g, '$botDelete(');
            processedCode = processedCode.replace(/ask\s*\(/g, '$ask(');
            processedCode = processedCode.replace(/waitForAnswer\s*\(/g, '$ask(');
            processedCode = processedCode.replace(/wait\s*\(/g, '$wait(');
            processedCode = processedCode.replace(/sleep\s*\(/g, '$wait(');
            processedCode = processedCode.replace(/runPython\s*\(/g, '$python(');
            
            // Handle bot method calls
            processedCode = processedCode.replace(/(Bot|bot|Api|api)\.(\w+)\s*\(/g, (match, prefix, method) => {
                if (['saveData', 'getData', 'deleteData', 'ask', 'waitForAnswer'].includes(method)) {
                    return match; // Already handled
                }
                return `$botCall('${method}', `;
            });

            // ✅ FIXED: Add return statement if missing
            const trimmedCode = processedCode.trim();
            if (!trimmedCode.includes('return ') && !trimmedCode.includes('Bot.send') && !trimmedCode.includes('bot.send') && 
                !trimmedCode.includes('Api.send') && !trimmedCode.includes('api.send')) {
                processedCode += '\nreturn "Command executed successfully";';
            }

            // ✅ FIXED: Execute the code
            try {
                const result = await createExecutionFunction(processedCode, enhancedEnv);
                return result;
            } catch (executionError) {
                console.error('❌ Code execution error:', executionError);
                throw executionError;
            }
        };

        // ✅ EXECUTE
        const result = await executeWithAutoAwait(code, baseExecutionEnv);
        return result;

    } catch (error) {
        console.error('💥 Execution Error:', error);
        
        // ✅ FIXED: Better error handling
        let errorMessage = error.message || 'Unknown execution error';
        
        // Handle AggregateError
        if (error.name === 'AggregateError') {
            errorMessage = `Connection Error: ${error.errors[0]?.message || 'Check Network/Supabase'}`;
        }
        
        // ✅ FIXED: Telegram-safe error message
        const markdownChars = ['*', '_', '`', '[', ']', '(', ')', '~', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
        for (const char of markdownChars) {
            errorMessage = errorMessage.split(char).join('\\' + char);
        }
        
        // Shorten very long error messages
        if (errorMessage.length > 500) {
            errorMessage = errorMessage.substring(0, 500) + '... [truncated]';
        }
        
        // Log the original error for debugging
        console.error('🔍 Original error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        throw new Error(errorMessage);
        
    } finally {
        try {
            await supabase.from('active_sessions').delete().eq('session_id', sessionKey);
        } catch (e) { 
            console.warn("⚠️ Session cleanup failed:", e.message);
        }
    }
}

console.log('✅ command-executor.js loaded successfully');
module.exports = { executeCommandCode };