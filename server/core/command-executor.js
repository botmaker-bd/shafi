const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase'); // আপনার প্রোজেক্টের পাথ অনুযায়ী ঠিক রাখুন
const pythonRunner = require('./python-runner'); // আপনার প্রোজেক্টের পাথ অনুযায়ী ঠিক রাখুন

/**
 * Executes dynamic code with sandbox environment, auto-await, and session management.
 * @param {Object} botInstance - The Telegram bot instance (node-telegram-bot-api)
 * @param {String} code - The JavaScript code to execute
 * @param {Object} context - The context object {msg, chatId, userId, ...}
 */
async function executeCommandCode(botInstance, code, context) {
    // 🆔 Create Unique Session Key
    const sessionKey = `sess_${context.userId}_${Date.now()}`;
    const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;

    return new Promise(async (resolve, reject) => {
        try {
            // ---------------------------------------------------------
            // 1. TOKEN & SESSION SETUP
            // ---------------------------------------------------------
            
            // ✅ Resolve Bot Token (Fallback mechanism)
            let resolvedBotToken = botToken;
            if (!resolvedBotToken && context.command) {
                resolvedBotToken = context.command.bot_token;
            }
            if (!resolvedBotToken) {
                try {
                    const botInfo = await botInstance.getMe();
                    resolvedBotToken = botInfo.token || 'fallback_token';
                } catch (e) {
                    resolvedBotToken = 'fallback_token';
                }
            }

            // ✅ Start Session in Supabase
            // (কোড রান শুরু হলে এখানে এন্ট্রি হবে)
            try {
                await supabase.from('active_sessions').insert({
                    session_id: sessionKey,
                    bot_token: resolvedBotToken,
                    user_id: userId.toString(),
                    chat_id: chatId.toString(),
                    started_at: new Date().toISOString(),
                    status: 'running'
                });
            } catch (sessionError) {
                console.warn('⚠️ Session logging failed (non-critical):', sessionError.message);
            }

            console.log(`🚀 Executing Script for User: ${userId} | Session: ${sessionKey}`);

            // ---------------------------------------------------------
            // 2. DATA FUNCTIONS (User.*, Bot.*)
            // ---------------------------------------------------------

            // 👤 User Data (User.saveData, User.getData)
            const userDataFunctions = {
                saveData: async (key, value) => {
                    const { error } = await supabase.from('universal_data').upsert({
                        data_type: 'user_data',
                        bot_token: resolvedBotToken,
                        user_id: userId.toString(),
                        data_key: key,
                        data_value: JSON.stringify(value),
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'data_type,bot_token,user_id,data_key' });
                    
                    if (error) throw new Error(`User.saveData failed: ${error.message}`);
                    return value;
                },
                
                getData: async (key) => {
                    const { data } = await supabase.from('universal_data')
                        .select('data_value')
                        .match({ 
                            data_type: 'user_data', 
                            bot_token: resolvedBotToken, 
                            user_id: userId.toString(), 
                            data_key: key 
                        })
                        .maybeSingle(); // .maybeSingle() prevents 'PGRST116' error

                    if (!data) return null;
                    try { return JSON.parse(data.data_value); } catch { return data.data_value; }
                },

                deleteData: async (key) => {
                    await supabase.from('universal_data').delete()
                        .match({ 
                            data_type: 'user_data', 
                            bot_token: resolvedBotToken, 
                            user_id: userId.toString(), 
                            data_key: key 
                        });
                    return true;
                }
            };

            // 🤖 Bot Data (Bot.saveData, bot.saveData)
            const botDataFunctions = {
                saveData: async (key, value) => {
                    // Check logic for robustness
                    const { data: existing } = await supabase.from('universal_data').select('id')
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key })
                        .maybeSingle();
                    
                    const payload = {
                        data_type: 'bot_data',
                        bot_token: resolvedBotToken,
                        data_key: key,
                        data_value: JSON.stringify(value),
                        updated_at: new Date().toISOString()
                    };

                    if (existing) {
                        await supabase.from('universal_data').update(payload).eq('id', existing.id);
                    } else {
                        await supabase.from('universal_data').insert({ ...payload, created_at: new Date().toISOString() });
                    }
                    return value;
                },

                getData: async (key) => {
                    const { data } = await supabase.from('universal_data').select('data_value')
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key })
                        .maybeSingle();

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

            // API Wrapper Context
            const apiContext = {
                msg, chatId, userId, 
                username: username || '', 
                first_name: first_name || '',
                botToken: resolvedBotToken, 
                userInput, 
                nextCommandHandlers 
            };
            const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);

            // Messaging Wrapper
            const sendMessageFunction = async (text, options) => {
                return await botInstance.sendMessage(chatId, text, options);
            };

            // 🛠️ Construct Bot Object (Used for 'Bot', 'bot', 'Api', 'api')
            const botObject = {
                // Messaging aliases
                sendMessage: sendMessageFunction,
                send: sendMessageFunction,
                reply: (text, opt) => botInstance.sendMessage(chatId, text, { reply_to_message_id: msg.message_id, ...opt }),
                
                // Data aliases
                saveData: botDataFunctions.saveData,
                getData: botDataFunctions.getData,
                deleteData: botDataFunctions.deleteData,

                // Access to all API wrapper methods
                ...apiWrapperInstance
            };

            // 📦 THE SANDBOX ENVIRONMENT
            const baseExecutionEnv = {
                // --- Aliases for User Convenience ---
                Bot: botObject,
                bot: botObject,
                Api: botObject,
                api: botObject,

                // --- User Data ---
                User: userDataFunctions,

                // --- Context ---
                msg: msg,
                chatId: chatId,
                userId: userId,
                // ⚠️ NOTE: 'user' variable is INTENTIONALLY OMITTED.
                // This allows the user to write "let user = 'something'" without error.
                currentUser: msg.from || { id: userId }, // Use this to get user info

                // --- Utilities ---
                wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
                sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
                runPython: (c) => pythonRunner.runPythonCodeSync(c)
            };

            // ---------------------------------------------------------
            // 4. AUTO-AWAIT ENGINE
            // ---------------------------------------------------------

            const executeWithAutoAwait = async (userCode, env) => {
                // A. Internal Helper for Awaited Calls
                const __autoAwait = {
                    UserSave: (k, v) => env.User.saveData(k, v),
                    UserGet: (k) => env.User.getData(k),
                    UserDel: (k) => env.User.deleteData(k),
                    
                    BotDataSave: (k, v) => env.bot.saveData(k, v),
                    BotDataGet: (k) => env.bot.getData(k),
                    BotDataDel: (k) => env.bot.deleteData(k),
                    
                    BotSend: (txt, opt) => env.bot.sendMessage(txt, opt)
                };

                // B. Add helper to environment
                const enhancedEnv = { ...env, __autoAwait };

                // C. Regex Replacements (Handling Spaces & Aliases)
                let processedCode = userCode;
                const rules = [
                    // User Data (User.saveData, User.getData...)
                    { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                    { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                    { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                    
                    // Bot Data (Bot.saveData, bot.saveData...)
                    { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                    { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                    { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                    
                    // Messaging (Bot.sendMessage, Api.sendMessage, bot.sendMessage...)
                    { r: /(Bot|bot|Api|api)\s*\.\s*sendMessage\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotSend($2)' }
                ];

                // Apply Regex Rules
                rules.forEach(rule => {
                    processedCode = processedCode.replace(rule.r, rule.to);
                });

                // Debug log (Optional, remove in production if too noisy)
                // console.log('📝 Processed Code:', processedCode);

                // D. Execution using Function Constructor
                const run = new Function('env', `
                    with(env) {
                        return (async function() {
                            try {
                                ${processedCode}
                                return "✅ Execution Successful";
                            } catch (err) {
                                throw err;
                            }
                        })();
                    }
                `);

                return await run(enhancedEnv);
            };

            // ✅ Run the code
            const result = await executeWithAutoAwait(code, baseExecutionEnv);
            resolve(result);

        } catch (error) {
            console.error('💥 Script Execution Error:', error);
            // Optional: Notify user of error
            // try { await botInstance.sendMessage(context.chatId, `❌ Script Error: ${error.message}`); } catch(e){}
            reject(error);
        } finally {
            // ---------------------------------------------------------
            // 5. SESSION CLEANUP (Always runs)
            // ---------------------------------------------------------
            try {
                // Delete session from Supabase
                const { error } = await supabase.from('active_sessions')
                    .delete()
                    .eq('session_id', sessionKey);
                
                if(error) console.error('⚠️ Session delete error:', error.message);
                else console.log(`🏁 Session Ended & Cleaned: ${sessionKey}`);
                
            } catch (cleanupError) {
                console.error('⚠️ Critical Session Cleanup Failed:', cleanupError);
            }
        }
    });
}

module.exports = { executeCommandCode };
