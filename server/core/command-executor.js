const ApiWrapper = require('./api-wrapper');
const supabase = require('../config/supabase');
const pythonRunner = require('./python-runner');

async function executeCommandCode(botInstance, code, context) {
    const { msg, userId, botToken, userInput, nextCommandHandlers } = context;
    
    let rawChatId = context.chatId || msg?.chat?.id;
    if (!rawChatId) {
        throw new Error("CRITICAL: Chat ID is missing in context!");
    }
    const chatId = String(rawChatId); 
    const sessionKey = `sess_${userId}_${Date.now()}`;

    let resolvedBotToken = botToken;
    if (!resolvedBotToken && context.command) resolvedBotToken = context.command.bot_token;
    
    if (!resolvedBotToken) {
        try { const i = await botInstance.getMe(); resolvedBotToken = i.token; } 
        catch (e) { resolvedBotToken = 'fallback_token'; }
    }

    try {
        try {
            await supabase.from('active_sessions').insert({
                session_id: sessionKey, bot_token: resolvedBotToken, user_id: userId.toString(),
                chat_id: chatId, started_at: new Date().toISOString()
            });
        } catch (e) { /* ignore */ }

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
                const payload = { 
                    data_type: 'bot_data', bot_token: resolvedBotToken, 
                    data_key: key, data_value: JSON.stringify(value), updated_at: new Date().toISOString() 
                };
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

        const waitForAnswerLogic = async (question, options = {}) => {
            return new Promise((resolveWait, rejectWait) => {
                const waitKey = `${resolvedBotToken}_${userId}`;
                botInstance.sendMessage(chatId, question, options).then(() => {
                    const timeout = setTimeout(() => {
                        if (nextCommandHandlers?.has(waitKey)) {
                            nextCommandHandlers.delete(waitKey);
                            rejectWait(new Error('Timeout'));
                        }
                    }, 60000);

                    if (nextCommandHandlers) {
                        nextCommandHandlers.set(waitKey, {
                            resolve: (ans) => { clearTimeout(timeout); resolveWait(ans); },
                            reject: (err) => { clearTimeout(timeout); rejectWait(err); },
                            timestamp: Date.now()
                        });
                    }
                }).catch(e => rejectWait(e));
            });
        };

        const isChatId = (val) => {
            if (!val) return false;
            if (typeof val === 'number') return Number.isInteger(val) && Math.abs(val) > 200;
            if (typeof val === 'string') return val.startsWith('@') || /^-?\d+$/.test(val);
            return false;
        };

        const dynamicBotCaller = async (methodName, ...args) => {
            if (typeof botInstance[methodName] !== 'function') throw new Error(`Method '${methodName}' missing`);
            
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

        const apiCtx = { msg, chatId, userId, botToken: resolvedBotToken, userInput, nextCommandHandlers };
        const apiWrapperInstance = new ApiWrapper(botInstance, apiCtx);
        const botObject = { ...apiWrapperInstance, ...botDataFunctions };

        const baseExecutionEnv = {
            Bot: botObject, bot: botObject, Api: botObject, api: botObject,
            User: userDataFunctions,
            msg, chatId, userId,
            currentUser: msg.from || { id: userId, first_name: context.first_name || 'User' },
            wait: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            sleep: (sec) => new Promise(r => setTimeout(r, sec * 1000)),
            runPython: (c) => pythonRunner.runPythonCodeAsync(c),
            ask: waitForAnswerLogic,
            waitForAnswer: waitForAnswerLogic
        };

        const executeWithAutoAwait = async (userCode, env) => {
            const __autoAwait = {
                UserSave: (k, v) => env.User.saveData(k, v),
                UserGet: (k) => env.User.getData(k),
                UserDel: (k) => env.User.deleteData(k),
                BotDataSave: (k, v) => env.bot.saveData(k, v),
                BotDataGet: (k) => env.bot.getData(k),
                BotDataDel: (k) => env.bot.deleteData(k),
                Ask: (q, o) => env.ask(q, o),
                Wait: (s) => env.wait(s),
                BotGeneric: async (method, ...args) => {
                    return await dynamicBotCaller(method, ...args);
                }
            };

            const enhancedEnv = { ...env, __autoAwait };
            let processedCode = userCode;

            const rules = [
                { r: /User\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.UserSave($1)' },
                { r: /User\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.UserGet($1)' },
                { r: /User\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.UserDel($1)' },
                { r: /(Bot|bot)\s*\.\s*saveData\s*\(([^)]+)\)/g,   to: 'await __autoAwait.BotDataSave($2)' },
                { r: /(Bot|bot)\s*\.\s*getData\s*\(([^)]+)\)/g,    to: 'await __autoAwait.BotDataGet($2)' },
                { r: /(Bot|bot)\s*\.\s*deleteData\s*\(([^)]+)\)/g, to: 'await __autoAwait.BotDataDel($2)' },
                { r: /(ask|waitForAnswer)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Ask($2)' },
                { r: /(wait|sleep)\s*\(([^)]+)\)/g, to: 'await __autoAwait.Wait($2)' },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer)([a-zA-Z0-9_]+)\s*\(\s*\)/g, to: "await __autoAwait.BotGeneric('$2')" },
                { r: /(Bot|bot|Api|api)\s*\.\s*(?!saveData|getData|deleteData|ask|waitForAnswer)([a-zA-Z0-9_]+)\s*\(/g, to: "await __autoAwait.BotGeneric('$2', " }
            ];

            rules.forEach(rule => { processedCode = processedCode.replace(rule.r, rule.to); });

            const run = new Function('env', `
                with(env) {
                    return (async function() {
                        try { 
                            ${processedCode} 
                            ; return "✅ Success"; 
                        } 
                        catch (err) { throw err; }
                    })();
                }
            `);
            return await run(enhancedEnv);
        };

        return await executeWithAutoAwait(code, baseExecutionEnv);

    } catch (error) {
        console.error('💥 Execution Error:', error.message);
        throw error;
    } finally {
        try {
            await supabase.from('active_sessions').delete().eq('session_id', sessionKey);
        } catch (e) {}
    }
}

module.exports = { executeCommandCode };