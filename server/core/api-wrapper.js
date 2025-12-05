// server/core/api-wrapper.js - SIMPLIFIED VERSION
const axios = require('axios');

class ApiWrapper {
    constructor(bot, context) {
        this.bot = bot;
        this.context = context;
        this.setupCoreMethods();
    }

    setupCoreMethods() {
        // Only essential methods
        const coreMethods = [
            'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo',
            'sendAudio', 'sendVoice', 'sendLocation', 'sendContact',
            'sendPoll', 'sendChatAction', 'forwardMessage', 'copyMessage',
            'deleteMessage', 'getChat', 'getChatMember', 'getChatAdministrators',
            'getChatMemberCount', 'pinChatMessage', 'unpinChatMessage',
            'leaveChat', 'getMe', 'getFile', 'answerCallbackQuery',
            'answerInlineQuery'
        ];

        // Bind core methods
        coreMethods.forEach(method => {
            if (this.bot[method]) {
                this[method] = async (...args) => {
                    try {
                        return await this.bot[method](...args);
                    } catch (error) {
                        console.error(`❌ API ${method} failed:`, error.message);
                        throw error;
                    }
                };
            }
        });

        // Add Python method to Bot object
        this.runPython = async (code) => {
            const pythonRunner = require('./python-runner');
            return await pythonRunner.runPythonCode(code);
        };

        // Add installPython method
        this.installPython = async (packageName) => {
            try {
                const pythonRunner = require('./python-runner');
                return await pythonRunner.installPackage(packageName);
            } catch (error) {
                throw new Error(`Install failed: ${error.message}`);
            }
        };
    }
}

module.exports = ApiWrapper;