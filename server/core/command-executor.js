// server/core/command-executor.js - COMPLETELY FIXED VERSION
const ApiWrapper = require('./api-wrapper');

async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, nextCommandHandlers } = context;
            
            console.log(`\n🔧 ========== COMMAND EXECUTION START ==========`);
            console.log(`👤 User: ${first_name} (${userId})`);
            console.log(`🤖 Bot: ${botToken.substring(0, 15)}...`);
            console.log(`💬 Input: "${userInput}"`);
            console.log(`📝 Code length: ${code.length} characters`);
            console.log(`📊 nextCommandHandlers available: ${!!nextCommandHandlers}`);
            console.log(`🔑 Handler key would be: ${botToken}_${userId}`);

            // ✅ CRITICAL FIX: Ensure nextCommandHandlers is properly structured
            const executionContext = {
                msg: msg,
                chatId: chatId,
                userId: userId,
                username: username || '',
                first_name: first_name || '',
                last_name: context.last_name || '',
                language_code: context.language_code || '',
                botToken: botToken,
                userInput: userInput,
                nextCommandHandlers: nextCommandHandlers,
                User: context.User,
                Bot: context.Bot
            };

            // Create ApiWrapper instance
            const apiWrapper = new ApiWrapper(botInstance, executionContext);

            // Create enhanced execution environment with ALL required variables
            const executionEnv = {
                // === CORE TELEGRAM METHODS ===
                bot: botInstance,
                Api: apiWrapper,
                api: apiWrapper,
                Bot: apiWrapper,

                // === USER CONTEXT ===
                getUser: () => ({
                    id: userId,
                    username: username || '',
                    first_name: first_name || '',
                    last_name: context.last_name || '',
                    language_code: context.language_code || '',
                    chat_id: chatId
                }),

                // === MESSAGE DATA ===
                msg: msg,
                chatId: chatId,
                userId: userId,
                userInput: userInput,
                params: userInput,
                botToken: botToken,
                
                // === DATA STORAGE ===
                User: context.User,
                Bot: context.Bot,
                
                // === CRITICAL FIX: Direct access to nextCommandHandlers ===
                nextCommandHandlers: nextCommandHandlers,
                
                // === UTILITY FUNCTIONS ===
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                
                // === HTTP CLIENT ===
                HTTP: {
                    get: async (url, options = {}) => {
                        const axios = require('axios');
                        try {
                            console.log(`🌐 HTTP GET: ${url}`);
                            const response = await axios.get(url, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP GET failed: ${error.message}`);
                        }
                    },
                    post: async (url, data = {}, options = {}) => {
                        const axios = require('axios');
                        try {
                            console.log(`🌐 HTTP POST: ${url}`);
                            const response = await axios.post(url, data, options);
                            return response.data;
                        } catch (error) {
                            throw new Error(`HTTP POST failed: ${error.message}`);
                        }
                    }
                }
            };

            // ✅ FIXED: Enhanced execution code with PROPER variable injection
            const executionCode = `
                // === INJECT ALL REQUIRED VARIABLES ===
                const bot = this.context.bot;
                const Api = this.context.Api;
                const api = this.context.api;
                const Bot = this.context.Bot;
                const getUser = this.context.getUser;
                const User = this.context.User;
                const BotData = this.context.Bot;
                const msg = this.context.msg;
                const chatId = this.context.chatId;
                const userId = this.context.userId;
                const userInput = this.context.userInput;
                const params = this.context.params;
                const wait = this.context.wait;
                const HTTP = this.context.HTTP;
                
                // ✅ CRITICAL FIX: Inject nextCommandHandlers
                const nextCommandHandlers = this.context.nextCommandHandlers;
                
                // ✅ CRITICAL FIX: Inject waitForAnswer from Api
                const waitForAnswer = Api.waitForAnswer ? Api.waitForAnswer.bind(Api) : null;

                console.log('🚀 User code execution starting...');
                console.log('📊 Execution environment check:', {
                    hasBot: typeof bot !== 'undefined',
                    hasApi: typeof Api !== 'undefined', 
                    hasGetUser: typeof getUser !== 'undefined',
                    hasWaitForAnswer: typeof waitForAnswer === 'function',
                    hasNextCommandHandlers: typeof nextCommandHandlers !== 'undefined',
                    nextCommandHandlersType: typeof nextCommandHandlers,
                    nextCommandHandlersCount: nextCommandHandlers ? nextCommandHandlers.size : 0
                });

                // Validate critical functions
                if (typeof waitForAnswer !== 'function') {
                    throw new Error('waitForAnswer function is not available in Api');
                }
                
                if (typeof nextCommandHandlers === 'undefined') {
                    throw new Error('nextCommandHandlers is not defined in execution context');
                }

                try {
                    // ========================
                    // USER'S COMMAND CODE START
                    // ========================
                    ${code}
                    // ========================
                    // USER'S COMMAND CODE END
                    // ========================
                    
                    console.log('✅ User code executed successfully');
                    
                    // If no explicit return, return success
                    if (typeof result === 'undefined') {
                        return "Command executed successfully";
                    }
                    return result;
                } catch (error) {
                    console.error('❌ User code execution error:', error);
                    throw error;
                }
            `;

            const executionWrapper = {
                context: executionEnv
            };

            console.log('🚀 Executing user command code...');
            console.log('🔍 Execution environment prepared:', {
                hasApiWrapper: !!apiWrapper,
                hasWaitForAnswer: typeof apiWrapper.waitForAnswer === 'function',
                hasNextCommandHandlers: !!executionEnv.nextCommandHandlers
            });

            const commandFunction = new Function(executionCode);
            const boundFunction = commandFunction.bind(executionWrapper);
            
            const result = await boundFunction();
            
            console.log('✅ Command execution completed successfully');
            console.log(`📦 Result:`, result);
            console.log(`📊 Active handlers after execution: ${nextCommandHandlers?.size || 0}`);
            console.log(`✅ ========== COMMAND EXECUTION COMPLETE ==========\n`);
            
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            console.error('🔍 Error context details:', {
                message: error.message,
                hasNextCommandHandlers: !!context.nextCommandHandlers,
                contextKeys: Object.keys(context)
            });
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };