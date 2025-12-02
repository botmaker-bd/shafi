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
    
    // ✅ params extract করার improved লজিক
    let params = '';
    const command = context.command;
    
    if (command && command.command_patterns && fullUserInput) {
        const patterns = command.command_patterns.split(',').map(p => p.trim());
        
        for (const pattern of patterns) {
            // Exact match বা pattern দিয়ে শুরু হলে
            if (fullUserInput === pattern || fullUserInput.startsWith(pattern + ' ')) {
                // Pattern remove করে params নিন
                params = fullUserInput.substring(pattern.length).trim();
                break;
            }
            
            // Alternative: যদি pattern এ slash না থাকে কিন্তু user slash দিয়ে লিখে
            if (!pattern.startsWith('/') && fullUserInput.startsWith('/' + pattern)) {
                const patternWithSlash = '/' + pattern;
                if (fullUserInput === patternWithSlash || fullUserInput.startsWith(patternWithSlash + ' ')) {
                    params = fullUserInput.substring(patternWithSlash.length).trim();
                    break;
                }
            }
        }
    }
    
    // ✅ যদি params না পাওয়া যায়, পুরোটা ধরে নিন (কমান্ড ম্যাচ না করলে)
    if (params === '' && command && command.command_patterns) {
        // কমান্ড ম্যাচ করছে কিন্তু params নেই
        params = '';
    }
    
    const chatId = context.chatId || msg?.chat?.id;
    const nextCommandHandlers = context.nextCommandHandlers || new Map();
    
    // ✅ ডিবাগ লগ
    console.log(`🔍 command-executor context:`);
    console.log(`  - Command Patterns: "${command?.command_patterns}"`);
    console.log(`  - fullUserInput: "${fullUserInput}"`);
    console.log(`  - params: "${params}"`);
    console.log(`  - chatId: ${chatId}`);
    console.log(`  - userId: ${userId}`);
    
    if (!chatId) {
        throw new Error("CRITICAL: Chat ID is missing in context!");
    }
    
    const sessionKey = `sess_${userId}_${Date.now()}`;
    
    // --- 1. SETUP ---
    let resolvedBotToken = botToken;
    if (!resolvedBotToken && context.command) resolvedBotToken = context.command.bot_token;
    
    // Token Fallback
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

        // --- 6. ENVIRONMENT SETUP ---
        const apiCtx = { msg, chatId, userId, botToken: resolvedBotToken, userInput: fullUserInput, params, nextCommandHandlers };
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
            userInput: fullUserInput,    // ✅ সম্পূর্ণ user input (কমান্ড সহ)
            params: params,               // ✅ শুধুমাত্র কমান্ডের পরের অংশ
            currentUser: msg.from || { id: userId, first_name: context.first_name || 'User' },
            wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            runPython: (c) => pythonRunner.runPythonCodeSync(c),  // ✅ সরাসরি সিঙ্ক কল
            ask: waitForAnswerLogic,
            waitForAnswer: waitForAnswerLogic
        };

        // --- 7. AUTO-AWAIT ENGINE ---
        const executeWithAutoAwait = async (userCode, env) => {
            // ✅ এখানে __autoAwait define করুন
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
                    // ✅ await যোগ হবে
                    const result = await pythonRunner.runPythonCode(c);
                    return result;
                },
                BotGeneric: async (method, ...args) => {
                    return await dynamicBotCaller(method, ...args);
                }
            };

            // ✅ এখানে rules define করুন
            const rules = [
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                { r: /(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($2)' },
                { r: /(wait|sleep)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($2)' },
                { r: /runPython\s*\(([^)]+)\)/g, to: 'await __autoAwait.Python($1)' },  // ✅ নতুন rule
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

            // 🔥 FIX: User code এ context variable এর পরিবর্তে env ব্যবহার করুন
            const finalCode = `
                // Available variables in user code:
                // msg, chatId, userId, userInput, params, bot, Bot, User, currentUser, wait, sleep, runPython, ask
                
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
        // DETAILED ERROR LOGGING
        console.error('💥 Execution Error:', error);
        
        // Handle AggregateError specifically
        if (error.name === 'AggregateError') {
            console.error('🔍 Aggregate Errors:', error.errors);
            throw new Error(`Connection Error: ${error.errors[0]?.message || 'Check Network/Supabase'}`);
        }

        throw error;
    } finally {
        // CLEANUP
        try {
            await supabase.from('active_sessions').delete().eq('session_id', sessionKey);
        } catch (e) { /* ignore cleanup error */ }
    }
}

module.exports = { executeCommandCode };