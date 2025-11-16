// server/core/command-executor.js
const ApiWrapper = require('./api-wrapper');

async function executeCommandCode(botInstance, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            // Create execution environment
            const executionEnv = {
                // Telegram Bot
                bot: botInstance,
                
                // API Wrapper
                Api: new ApiWrapper(botInstance, context),
                
                // User information
                getUser: () => ({
                    id: context.userId,
                    username: context.username,
                    first_name: context.first_name,
                    last_name: context.last_name,
                    language_code: context.language_code,
                    chat_id: context.chatId
                }),
                
                // Message context
                msg: context.msg,
                chatId: context.chatId,
                userId: context.userId,
                userInput: context.userInput,
                params: context.params, // For answer handlers
                
                // Data storage
                User: context.User,
                Bot: context.Bot,
                
                // Utility functions
                wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
            };

            // Create execution code
            const executionCode = `
                const { bot, Api, getUser, User, Bot, msg, chatId, userId, userInput, params, wait } = this.context;
                
                // User's code execution
                ${code}
            `;

            // Execute the code
            const commandFunction = new Function(executionCode);
            const result = await commandFunction.bind({ context: executionEnv })();
            
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };