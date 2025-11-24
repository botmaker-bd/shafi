// server/core/command-executor.js - UPDATED BotData → Bot
const CodeTransformer = require('./code-transformer');

async function executeCommandCode(botInstance, code, context) {
  return new Promise(async (resolve, reject) => {
    try {
      const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
      
      // Resolve botToken if missing
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

      console.log('🔧 Starting command execution with AUTO-AWAIT');
      console.log('📝 Original code length:', code.length);

      // 🔥 AUTO-AWAIT TRANSFORMATION (includes BotData → Bot)
      let transformedCode;
      try {
        transformedCode = CodeTransformer.transform(code);
        console.log('✨ Transformed code length:', transformedCode.length);
        
        // Log transformation summary
        const originalLines = code.split('\n').length;
        const transformedLines = transformedCode.split('\n').length;
        console.log(`📊 Lines: ${originalLines} → ${transformedLines}`);
      } catch (transformError) {
        console.error('❌ Transformation failed, using original code:', transformError);
        transformedCode = code;
      }

      // Import dependencies
      const ApiWrapper = require('./api-wrapper');
      const pythonRunner = require('./python-runner');
      const supabase = require('../config/supabase');

      // Create context for ApiWrapper
      const apiContext = {
        msg: msg,
        chatId: chatId,
        userId: userId,
        username: username || '',
        first_name: first_name || '',
        last_name: context.last_name || '',
        language_code: context.language_code || '',
        botToken: resolvedBotToken,
        userInput: userInput,
        nextCommandHandlers: nextCommandHandlers || new Map()
      };

      // Create ApiWrapper instance
      const apiWrapperInstance = new ApiWrapper(botInstance, apiContext);

      // Helper functions
      const createUserObjectFunction = () => {
        const userObj = msg.from ? Object.assign({}, msg.from) : {
          id: userId,
          first_name: first_name || '',
          username: username || '',
          language_code: context.language_code || ''
        };
        userObj.chat_id = chatId;
        return userObj;
      };

      // Data storage functions - 🔥 BotData → Bot
      const userDataFunctions = {
        getData: async (key) => {
          try {
            const { data, error } = await supabase
              .from('universal_data')
              .select('data_value, metadata, updated_at')
              .eq('data_type', 'user_data')
              .eq('bot_token', resolvedBotToken)
              .eq('user_id', userId.toString())
              .eq('data_key', key)
              .single();

            if (error) {
              if (error.code === 'PGRST116') return null;
              console.error('❌ Get data error:', error);
              return null;
            }

            if (!data || !data.data_value) return null;

            try {
              return JSON.parse(data.data_value);
            } catch {
              return data.data_value;
            }
          } catch (error) {
            console.error('❌ Get data error:', error);
            return null;
          }
        },

        saveData: async (key, value) => {
          try {
            const { error } = await supabase
              .from('universal_data')
              .upsert({
                data_type: 'user_data',
                bot_token: resolvedBotToken,
                user_id: userId.toString(),
                data_key: key,
                data_value: JSON.stringify(value),
                metadata: {
                  saved_at: new Date().toISOString(),
                  value_type: typeof value
                },
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'data_type,bot_token,user_id,data_key'
              });

            if (error) throw error;
            return value;
          } catch (error) {
            console.error('❌ Save data error:', error);
            throw error;
          }
        },

        deleteData: async (key) => {
          try {
            const { error } = await supabase
              .from('universal_data')
              .delete()
              .eq('data_type', 'user_data')
              .eq('bot_token', resolvedBotToken)
              .eq('user_id', userId.toString())
              .eq('data_key', key);

            if (error) throw error;
            return true;
          } catch (error) {
            console.error('❌ Delete data error:', error);
            throw error;
          }
        },

        increment: async (key, amount = 1) => {
          try {
            const current = await userDataFunctions.getData(key) || 0;
            const newValue = parseInt(current) + parseInt(amount);
            await userDataFunctions.saveData(key, newValue);
            return newValue;
          } catch (error) {
            console.error('❌ Increment data error:', error);
            throw error;
          }
        },

        getAllData: async () => {
          try {
            const { data, error } = await supabase
              .from('universal_data')
              .select('data_key, data_value, updated_at')
              .eq('data_type', 'user_data')
              .eq('bot_token', resolvedBotToken)
              .eq('user_id', userId.toString());

            if (error) return {};

            const result = {};
            for (const item of data || []) {
              try {
                result[item.data_key] = JSON.parse(item.data_value);
              } catch {
                result[item.data_key] = item.data_value;
              }
            }
            return result;
          } catch (error) {
            console.error('❌ Get all data error:', error);
            return {};
          }
        },

        clearAll: async () => {
          try {
            const { error } = await supabase
              .from('universal_data')
              .delete()
              .eq('data_type', 'user_data')
              .eq('bot_token', resolvedBotToken)
              .eq('user_id', userId.toString());

            if (error) throw error;
            return true;
          } catch (error) {
            console.error('❌ Clear all data error:', error);
            throw error;
          }
        }
      };

      // 🔥 BotData → Bot renamed
      const botDataFunctions = {
        getData: async (key) => {
          try {
            const { data, error } = await supabase
              .from('universal_data')
              .select('data_value, metadata, updated_at')
              .eq('data_type', 'bot_data')
              .eq('bot_token', resolvedBotToken)
              .eq('data_key', key)
              .single();

            if (error) {
              if (error.code === 'PGRST116') return null;
              return null;
            }

            if (!data || !data.data_value) return null;

            try {
              return JSON.parse(data.data_value);
            } catch {
              return data.data_value;
            }
          } catch (error) {
            console.error('❌ Get bot data error:', error);
            return null;
          }
        },

        saveData: async (key, value) => {
          try {
            const { error } = await supabase
              .from('universal_data')
              .upsert({
                data_type: 'bot_data',
                bot_token: resolvedBotToken,
                data_key: key,
                data_value: JSON.stringify(value),
                metadata: {
                  saved_at: new Date().toISOString(),
                  value_type: typeof value
                },
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'data_type,bot_token,data_key'
              });

            if (error) throw error;
            return value;
          } catch (error) {
            console.error('❌ Save bot data error:', error);
            throw error;
          }
        },

        deleteData: async (key) => {
          try {
            const { error } = await supabase
              .from('universal_data')
              .delete()
              .eq('data_type', 'bot_data')
              .eq('bot_token', resolvedBotToken)
              .eq('data_key', key);

            if (error) throw error;
            return true;
          } catch (error) {
            console.error('❌ Delete bot data error:', error);
            throw error;
          }
        }
      };

      // Create bot object with all methods - 🔥 BotData → Bot
      const createBotObject = () => {
        const botObj = {
          ...apiWrapperInstance,
          User: userDataFunctions,
          Bot: botDataFunctions  // 🔥 Changed from BotData to Bot
        };
        return botObj;
      };

      const botObject = createBotObject();

      // Create execution environment - 🔥 BotData → Bot
      const executionEnv = {
        // Core functions
        getUser: createUserObjectFunction,
        getChat: createChatObjectFunction,
        getCurrentUser: createUserObjectFunction,
        getCurrentChat: createChatObjectFunction,
        
        // Bot instances
        Bot: botObject,        // 🔥 This is the Telegram Bot
        bot: botObject,        // 🔥 This is the Telegram Bot  
        api: botObject,
        Api: botObject,
        API: botObject,
        
        // Context data
        msg: msg,
        chatId: chatId,
        userId: userId,
        userInput: userInput,
        params: userInput ? userInput.split(' ').slice(1).filter(p => p.trim() !== '') : [],
        message: userInput,
        botToken: resolvedBotToken,
        
        // Utility functions
        wait: waitFunction,
        delay: waitFunction,
        sleep: waitFunction,
        runPython: runPythonSyncFunction,
        executePython: runPythonSyncFunction,
        waitForAnswer: waitForAnswerFunction,
        ask: waitForAnswerFunction,
        
        // Data storage - 🔥 BotData → Bot
        User: userDataFunctions,
        Bot: botDataFunctions,  // 🔥 Changed from BotData to Bot
        
        // Handlers
        nextCommandHandlers: nextCommandHandlers,
        
        // Data objects
        userData: createUserObjectFunction(),
        chatData: createChatObjectFunction(),
        currentUser: createUserObjectFunction(),
        currentChat: createChatObjectFunction()
      };

      // Add direct message functions
      Object.assign(executionEnv, {
        sendMessage: (text, options) => botInstance.sendMessage(chatId, text, options),
        send: (text, options) => botInstance.sendMessage(chatId, text, options),
        reply: (text, options) => botInstance.sendMessage(chatId, text, {
          reply_to_message_id: msg.message_id,
          ...options
        }),
        sendPhoto: (photo, options) => botInstance.sendPhoto(chatId, photo, options),
        sendDocument: (doc, options) => botInstance.sendDocument(chatId, doc, options),
        sendVideo: (video, options) => botInstance.sendVideo(chatId, video, options),
        sendAudio: (audio, options) => botInstance.sendAudio(chatId, audio, options),
        sendVoice: (voice, options) => botInstance.sendVoice(chatId, voice, options),
        sendLocation: (latitude, longitude, options) => botInstance.sendLocation(chatId, latitude, longitude, options),
        sendContact: (phoneNumber, firstName, options) => botInstance.sendContact(chatId, phoneNumber, firstName, options)
      });

      // Create execution function with transformed code
      const executionFunction = new Function('env', `
        return (async function() {
          try {
            // Extract all variables from env
            var Bot = env.Bot;
            var bot = env.bot;
            var Api = env.Api;
            var api = env.api;
            var API = env.API;
            var User = env.User;
            var BotData = env.BotData;
            var msg = env.msg;
            var chatId = env.chatId;
            var userId = env.userId;
            var userInput = env.userInput;
            var params = env.params;
            var message = env.message;
            var getUser = env.getUser;
            var getChat = env.getChat;
            var getCurrentUser = env.getCurrentUser;
            var getCurrentChat = env.getCurrentChat;
            var sendMessage = env.sendMessage;
            var send = env.send;
            var reply = env.reply;
            var sendPhoto = env.sendPhoto;
            var sendDocument = env.sendDocument;
            var sendVideo = env.sendVideo;
            var sendAudio = env.sendAudio;
            var sendVoice = env.sendVoice;
            var sendLocation = env.sendLocation;
            var sendContact = env.sendContact;
            var wait = env.wait;
            var delay = env.delay;
            var sleep = env.sleep;
            var runPython = env.runPython;
            var executePython = env.executePython;
            var waitForAnswer = env.waitForAnswer;
            var ask = env.ask;
            var nextCommandHandlers = env.nextCommandHandlers;
            var userData = env.userData;
            var chatData = env.chatData;
            var currentUser = env.currentUser;
            var currentChat = env.currentChat;

            console.log('🚀 Executing TRANSFORMED code with auto-await...');
            
            // Transformed user code with auto-await
            ${transformedCode}
            
            return "Command completed successfully with auto-await";
          } catch (error) {
            console.error('❌ Execution error in transformed code:', error);
            try {
              let errorMsg = "❌ Error: " + error.message;
              if (errorMsg.length > 200) {
                errorMsg = errorMsg.substring(0, 200) + "...";
              }
              await env.sendMessage(errorMsg);
            } catch (sendError) {
              console.error('Failed to send error message:', sendError);
            }
            throw error;
          }
        })();
      `);

      // Execute the transformed code
      console.log('🎯 Executing transformed command...');
      const result = await executionFunction(executionEnv);
      
      console.log('✅ Command execution completed with auto-await');
      resolve(result);

    } catch (error) {
      console.error('❌ Command execution failed:', error);
      reject(error);
    }
  });
}

module.exports = { executeCommandCode };