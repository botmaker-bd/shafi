// server/core/command-executor.js - executeCommandCode ফাংশন
async function executeCommandCode(bot, code, context) {
    return new Promise(async (resolve, reject) => {
        try {
            const { msg, chatId, userId, username, first_name, botToken, userInput, User, Bot } = context;
            
            // Enhanced execution environment with PROPER bot methods
            const executionEnv = {
                // ✅ FIXED: Proper bot instance with guaranteed message delivery
                bot: {
                    sendMessage: (text, options = {}) => {
                        console.log(`📤 Sending message to ${chatId}: ${text.substring(0, 50)}...`);
                        return bot.sendMessage(chatId, text, {
                            parse_mode: 'HTML',
                            ...options
                        }).then(result => {
                            console.log(`✅ Message delivered to ${chatId}`);
                            return result;
                        }).catch(error => {
                            console.error(`❌ Failed to send message to ${chatId}:`, error);
                            throw error;
                        });
                    },
                    
                    sendPhoto: (photo, options = {}) => {
                        return bot.sendPhoto(chatId, photo, {
                            parse_mode: 'HTML',
                            ...options
                        });
                    },
                    
                    sendDocument: (document, options = {}) => {
                        return bot.sendDocument(chatId, document, {
                            parse_mode: 'HTML',
                            ...options
                        });
                    }
                },
                
                // ✅ User information function
                getUser: () => ({
                    id: userId,
                    username: username,
                    first_name: first_name,
                    chat_id: chatId
                }),
                
                // Utility functions
                User: User,
                Bot: Bot,
                params: userInput,
                chatId: chatId,
                userId: userId
            };

            // ✅ SIMPLIFIED execution code
            const executionCode = `
                try {
                    const { bot, getUser, User, Bot, params, chatId, userId } = this.env;
                    
                    // User's code execution
                    ${code}
                    
                    return "Command executed successfully";
                } catch (error) {
                    throw error;
                }
            `;

            const executionContext = { env: executionEnv };
            const commandFunction = new Function(executionCode);
            const boundFunction = commandFunction.bind(executionContext);
            
            const result = await boundFunction();
            resolve(result);

        } catch (error) {
            console.error('❌ Command execution error:', error);
            reject(error);
        }
    });
}

module.exports = { executeCommandCode };