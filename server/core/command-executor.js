const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');

async function executeCommandCode(botInstance, code, context) {
    const sessionKey = `sess_${context.userId}_${Date.now()}`;
    const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;

    return new Promise(async (resolve, reject) => {
        try {
            // --- 1. SETUP & SESSION ---
            let resolvedBotToken = botToken;
            if (!resolvedBotToken && context.command) resolvedBotToken = context.command.bot_token;
            if (!resolvedBotToken) {
                try { const i = await botInstance.getMe(); resolvedBotToken = i.token; } 
                catch (e) { resolvedBotToken = 'fallback_token'; }
            }

            // সেশন শুরু
            try {
                await supabase.from('active_sessions').insert({
                    session_id: sessionKey, bot_token: resolvedBotToken, user_id: userId.toString(),
                    chat_id: chatId.toString(), started_at: new Date().toISOString()
                });
            } catch (e) { /* non-critical */ }

            // --- 2. DATA FUNCTIONS (Delete সহ) ---
            const userDataFunctions = {
                saveData: async (key, value) => {
                    await supabase.from('universal_data').upsert({
                        data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(),
                        data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString()
                    }, { onConflict: 'data_type,bot_token,user_id,data_key' });
                    return value;
                },
                getData: async (key) => {
                    const { data } = await supabase.from('universal_data').select('data_value')
                        .match({ data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(), data_key: key })
                        .maybeSingle();
                    try { return data ? JSON.parse(data.data_value) : null; } catch { return data?.data_value; }
                },
                deleteData: async (key) => {
                    await supabase.from('universal_data').delete()
                        .match({ data_type: 'user_data', bot_token: resolvedBotToken, user_id: userId.toString(), data_key: key });
                    return true;
                }
            };

            const botDataFunctions = {
                saveData: async (key, value) => {
                    const { data: exist } = await supabase.from('universal_data').select('id')
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key }).maybeSingle();
                    const payload = { data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString() };
                    if (exist) await supabase.from('universal_data').update(payload).eq('id', exist.id);
                    else await supabase.from('universal_data').insert({ ...payload, created_at: new Date().toISOString() });
                    return value;
                },
                getData: async (key) => {
                    const { data } = await supabase.from('universal_data').select('data_value')
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key }).maybeSingle();
                    try { return data ? JSON.parse(data.data_value) : null; } catch { return data?.data_value; }
                },
                deleteData: async (key) => {
                    await supabase.from('universal_data').delete()
                        .match({ data_type: 'bot_data', bot_token: resolvedBotToken, data_key: key });
                    return true;
                }
            };

            // --- 3. INTERACTION FUNCTION (Ask/WaitForAnswer) ---
            const waitForAnswerLogic = async (question, options = {}) => {
                return new Promise((resolveWait, rejectWait) => {
                    const waitKey = `${resolvedBotToken}_${userId}`;
                    
                    // প্রশ্ন পাঠানো (স্মার্টলি)
                    botInstance.sendMessage(chatId, question, options).then(() => {
                        const timeout = setTimeout(() => {
                            if (nextCommandHandlers?.has(waitKey)) {
                                nextCommandHandlers.delete(waitKey);
                                rejectWait(new Error('Timeout (User took too long)'));
                            }
                        }, 5 * 60 * 1000); // ৫ মিনিট টাইমআউট

                        nextCommandHandlers.set(waitKey, {
                            resolve: (ans) => { clearTimeout(timeout); resolveWait(ans); },
                            reject: (err) => { clearTimeout(timeout); rejectWait(err); },
                            timestamp: Date.now()
                        });
                    }).catch(e => rejectWait(e));
                });
            };

            // --- 4. SMART BOT WRAPPER (Handles ALL API methods) ---
            
            // হেল্পার: চেক করবে প্রথম আর্গুমেন্ট চ্যাট আইডি কিনা
            const isChatId = (val) => {
                if (typeof val === 'number') return true;
                if (typeof val === 'string') {
                    // যদি @ দিয়ে শুরু হয় অথবা শুধু নাম্বার হয় অথবা - (মাইনাস) দিয়ে শুরু হয়
                    return val.startsWith('@') || val.startsWith('-') || /^\d+$/.test(val);
                }
                return false;
            };

            // ডাইনামিক কল হ্যান্ডলার
            const dynamicBotCaller = async (methodName, ...args) => {
                if (typeof botInstance[methodName] !== 'function') {
                    throw new Error(`Method ${methodName} does not exist in Telegram API`);
                }

                // স্পেশাল মেথড যেগুলোতে chatId লাগে না
                const noChatIdMethods = ['getMe', 'getWebhookInfo', 'deleteWebhook', 'setWebhook', 'answerCallbackQuery', 'answerInlineQuery', 'stopPoll'];

                // যদি আর্গুমেন্ট থাকে এবং মেথডটি স্পেশাল লিস্টে না থাকে
                if (!noChatIdMethods.includes(methodName)) {
                    // যদি কোনো আর্গুমেন্ট না থাকে অথবা প্রথম আর্গুমেন্ট chatId না মনে হয়
                    // তাহলে বর্তমান chatId সামনে বসিয়ে দাও
                    if (args.length === 0 || !isChatId(args[0])) {
                         // কিছু মেথড যেমন editMessageText এর লজিক আলাদা হতে পারে, 
                         // তবে সাধারণ সেন্ডিং মেথডগুলোর জন্য এটি কাজ করবে।
                         // editMessageText এর ক্ষেত্রে সাধারণত (text, options) হয় যেখানে options এ chat_id থাকে।
                         
                         if (methodName.startsWith('send') || methodName === 'forwardMessage' || methodName === 'copyMessage') {
                             args.unshift(chatId);
                         } else if (methodName.startsWith('editMessage')) {
                             // editMessage এর জন্য অপশন চেক করা জটিল, তাই ইউজারের উপর ছাড়া হলো,
                             // তবে সিম্পল টেক্সট এডিটের জন্য সাপোর্ট দেওয়া হলো:
                             if (typeof args[1] !== 'object') { 
                                 // যদি ব্যবহারকারী শুধু টেক্সট দেয়: bot.editMessage("New Text") -> Error হবে কারণ msgId লাগে
                                 // তাই এটা বাইপাস করা হলো। ইউজারকে bot.editMessage("Text", {chat_id, message_id}) দিতে হবে।
                             }
                         }
                    }
                }
                
                return await botInstance[methodName](...args);
            };

            // --- 5. ENVIRONMENT SETUP ---
            
            const apiCtx = { msg, chatId, userId, botToken: resolvedBotToken, userInput, nextCommandHandlers };
            const apiWrapperInstance = new ApiWrapper(botInstance, apiCtx);

            // এই অবজেক্টটি স্ক্রিপ্টে Bot/Api নামে যাবে
            // আমরা এখানে Proxy ব্যবহার করছি না কারণ AutoAwait Regex দিয়ে হ্যান্ডেল করবে
            const botObject = {
                ...apiWrapperInstance,
                ...botDataFunctions
            };

            const baseExecutionEnv = {
                // Objects
                Bot: botObject, bot: botObject, Api: botObject, api: botObject,
                User: userDataFunctions,
                
                // Context
                msg, chatId, userId,
                currentUser: msg.from || { id: userId, first_name: first_name || '' },
                
                // Utils
                wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
                sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
                runPython: (c) => pythonRunner.runPythonCodeSync(c),
                
                // Aliases
                ask: waitForAnswerLogic,
                waitForAnswer: waitForAnswerLogic
            };

            // --- 6. AUTO-AWAIT ENGINE (THE MAGIC) ---
            const executeWithAutoAwait = async (userCode, env) => {
                const __autoAwait = {
                    // Data Methods
                    UserSave: (k, v) => env.User.saveData(k, v),
                    UserGet: (k) => env.User.getData(k),
                    UserDel: (k) => env.User.deleteData(k),
                    
                    BotDataSave: (k, v) => env.bot.saveData(k, v),
                    BotDataGet: (k) => env.bot.getData(k),
                    BotDataDel: (k) => env.bot.deleteData(k),
                    
                    // Interaction
                    Ask: (q, o) => env.ask(q, o),

                    // 🔥 UNIVERSAL BOT CALLER
                    // এটি যেকোনো মেথড (sendMessage, restrictMember ইত্যাদি) হ্যান্ডেল করবে
                    BotGeneric: async (method, ...args) => {
                        return await dynamicBotCaller(method, ...args);
                    }
                };

                const enhancedEnv = { ...env, __autoAwait };
                let processedCode = userCode;

                // 🛡️ REGEX RULES
                const rules = [
                    // ১. ডেটা হ্যান্ডলিং
                    { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                    { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                    { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                    
                    { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                    { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                    { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },

                    // ২. ask / waitForAnswer
                    { r: /(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($2)' },

                    // ৩. 🔥 UNIVERSAL API CATCHER
                    // এটি Bot.AnyMethod(...) কে ধরে await __autoAwait.BotGeneric('AnyMethod', ...) বানাবে
                    // কিন্তু আমাদের কাস্টম মেথডগুলো (saveData, getData) ইগনোর করতে হবে
                    { 
                        r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer)([a-zA-Z0-9_]+)\s*\(/g, 
                        to: "await __autoAwait.BotGeneric('$2', " 
                    }
                ];

                // রুলস অ্যাপ্লাই
                rules.forEach(rule => { processedCode = processedCode.replace(rule.r, rule.to); });

                // রান করা
                const run = new Function('env', `
                    with(env) {
                        return (async function() {
                            try { 
                                ${processedCode} 
                                return "✅ Execution Complete"; 
                            } catch (err) { throw err; }
                        })();
                    }
                `);
                return await run(enhancedEnv);
            };

            const result = await executeWithAutoAwait(code, baseExecutionEnv);
            resolve(result);

        } catch (error) {
            console.error('💥 Error:', error.message);
            reject(error);
        } finally {
            await supabase.from('active_sessions').delete().eq('session_id', sessionKey);
        }
    });
}

module.exports = { executeCommandCode };