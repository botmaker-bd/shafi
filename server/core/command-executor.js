const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase'); 
const pythonRunner = require('./python-runner'); 

/**
 * Executes dynamic code with sandbox environment, auto-await, and session management.
 */
async function executeCommandCode(botInstance, code, context) {
    const sessionKey = `sess_${context.userId}_${Date.now()}`;
    const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;

    return new Promise(async (resolve, reject) => {
        try {
            // ---------------------------------------------------------
            // 1. TOKEN & SESSION SETUP
            // ---------------------------------------------------------
            let resolvedBotToken = botToken;
            if (!resolvedBotToken && context.command) resolvedBotToken = context.command.bot_token;
            if (!resolvedBotToken) {
                try {
                    const botInfo = await botInstance.getMe();
                    resolvedBotToken = botInfo.token || 'fallback_token';
                } catch (e) { resolvedBotToken = 'fallback_token'; }
            }

            try {
                await supabase.from('active_sessions').insert({
                    session_id: sessionKey,
                    bot_token: resolvedBotToken,
                    user_id: userId.toString(),
                    chat_id: chatId.toString(),
                    started_at: new Date().toISOString(),
                    status: 'running'
                });
            } catch (sessionError) { console.warn('⚠️ Session Log Error:', sessionError.message); }

            console.log(`🚀 Executing Script for User: ${userId}`);

            // ---------------------------------------------------------
            // 2. HELPER FUNCTIONS (Wait, Ask, Data)
            // ---------------------------------------------------------

            // ⏳ Wait for Answer Function (The Logic)
            const waitForAnswerFunction = async (question, options = {}) => {
                return new Promise((resolveWait, rejectWait) => {
                    const waitKey = `${resolvedBotToken}_${userId}`;
                    
                    // Send the question
                    botInstance.sendMessage(chatId, question, options)
                        .then(() => {
                            if (!nextCommandHandlers) return rejectWait(new Error('Handler system missing'));

                            // Set Timeout (5 mins)
                            const timeoutId = setTimeout(() => {
                                if (nextCommandHandlers.has(waitKey)) {
                                    nextCommandHandlers.delete(waitKey);
                                    rejectWait(new Error('⏳ Timeout: No answer received.'));
                                }
                            }, 5 * 60 * 1000);

                            // Register Handler
                            nextCommandHandlers.set(waitKey, {
                                resolve: (answer) => {
                                    clearTimeout(timeoutId);
                                    resolveWait(answer);
                                },
                                reject: (err) => {
                                    clearTimeout(timeoutId);
                                    rejectWait(err);
                                },
                                timestamp: Date.now()
                            });
                        })
                        .catch(err => rejectWait(err));
                });
            };

            // 👤 User Data
            const userDataFunctions = {
                saveData: async (key, value) => {
                    const { error } = await supabase.from('universal_data').upsert({
                        data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(),
                        data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString()
                    }, { onConflict: 'data_type,bot_token,user_id,data_key' });
                    if (error) throw error;
                    return value;
                },
                getData: async (key) => {
                    const { data } = await supabase.from('universal_data').select('data_value')
                        .match({ data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(), data_key: key })
                        .maybeSingle();
                    if (!data) return null;
                    try { return JSON.parse(data.data_value); } catch { return data.data_value; }
                },
                deleteData: async (key) => {
                    await supabase.from('universal_data').delete()
                        .match({ data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(), data_key: key });
                    return true;
                }
            };

            // 🤖 Bot Data
            const botDataFunctions = {
                saveData: async (key, value) => {
                    const { data: existing } = await supabase.from('universal_data').select('id')
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key }).maybeSingle();
                    const payload = {
                        data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key,
                        data_value: JSON.stringify(value), updated_at: new Date().toISOString()
                    };
                    if (existing) await supabase.from('universal_data').update(payload).eq('id', existing.id);
                    else await supabase.from('universal_data').insert({ ...payload, created_at: new Date().toISOString() });
                    return value;
                },
                getData: async (key) => {
                    const { data } = await supabase.from('universal_data').select('data_value')
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key }).maybeSingle();
                    if (!data) return null;
                    try { return JSON.parse(data.data_value); } catch { return data.data_value; }
                },
                deleteData: async (key) => {
                    await supabase.from('universal_data').delete()
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key });
                    return true;
                }
            };

            // ---------------------------------------------------------
            // 3. ENVIRONMENT SETUP
            // ---------------------------------------------------------
            const apiContext = { msg, chatId, userId, username: username || '', first_name: first_name || '', botToken: resolvedBotToken, userInput, nextCommandHandlers };
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);
            const sendMessageFunction = async (text, options) => botInstance.sendMessage(chatId, text, options);

            // Bot Object
            const botObject = {
                sendMessage: sendMessageFunction,
                send: sendMessageFunction,
                reply: (text, opt) => botInstance.sendMessage(chatId, text, { reply_to_message_id: msg.message_id, ...opt }),
                saveData: botDataFunctions.saveData,
                getData: botDataFunctions.getData,
                deleteData: botDataFunctions.deleteData,
                ...apiWrapperInstance
            };

            // 📦 THE SANDBOX ENVIRONMENT
            const baseExecutionEnv = {
                Bot: botObject, bot: botObject, Api: botObject, api: botObject,
                User: userDataFunctions,
                
                // Context
                msg, chatId, userId,
                currentUser: msg.from || { id: userId },

                // Utilities (Exposed to Environment)
                // ✅ FIX: ask এবং waitForAnswer এখানে যোগ করা হয়েছে
                ask: waitForAnswerFunction,
                waitForAnswer: waitForAnswerFunction,
                
                wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
                sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
                runPython: (c) => pythonRunner.runPythonCodeSync(c)
            };

            // ---------------------------------------------------------
            // 4. AUTO-AWAIT ENGINE
            // ---------------------------------------------------------
            const executeWithAutoAwait = async (userCode, env) => {
                const __autoAwait = {
                    UserSave: (k, v) => env.User.saveData(k, v),
                    UserGet: (k) => env.User.getData(k),
                    UserDel: (k) => env.User.deleteData(k),
                    BotDataSave: (k, v) => env.bot.saveData(k, v),
                    BotDataGet: (k) => env.bot.getData(k),
                    BotDataDel: (k) => env.bot.deleteData(k),
                    BotSend: (txt, opt) => env.bot.sendMessage(txt, opt),
                    
                    // ✅ FIX: Ask এবং Wait এর জন্য র‍্যাপার
                    Ask: (q, o) => env.ask(q, o),
                    Wait: (s) => env.wait(s)
                };

                const enhancedEnv = { ...env, __autoAwait };
                let processedCode = userCode;

                const rules = [
                    // User Data
                    { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserSave($1)' },
                    { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,  to: 'await __autoAwait.UserGet($1)' },
                    { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                    
                    // Bot Data
                    { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataSave($2)' },
                    { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,  to: 'await __autoAwait.BotDataGet($2)' },
                    { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                    
                    // Messaging
                    { r: /(Bot|bot|Api|api)\s*\.\s*sendMessage\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotSend($2)' },

                    // ✅ FIX: Ask এবং Wait এর জন্য Auto-await Rules
                    { r: /(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($2)' },
                    { r: /(wait|sleep)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($2)' }
                ];

                rules.forEach(rule => {
                    processedCode = processedCode.replace(rule.r, rule.to);
                });

                // console.log('📝 Processed Code:', processedCode);

                const run = new Function('env', `
                    with(env) {
                        return (async function() {
                            try {
                                ${processedCode}
                                return "✅ Done";
                            } catch (err) { throw err; }
                        })();
                    }
                `);
                return await run(enhancedEnv);
            };

            const result = await executeWithAutoAwait(code, baseExecutionEnv);
            resolve(result);

        } catch (error) {
            console.error('💥 Error:', error);
            try { await botInstance.sendMessage(context.chatId, `❌ Command Error: ${error.message}`); } catch(e){}
            reject(error);
        } finally {
            try { await supabase.from('active_sessions').delete().eq('session_id', sessionKey); } catch (e) {}
        }
    });
}

module.exports = { executeCommandCode };