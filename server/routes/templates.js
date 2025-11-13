const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// টেমপ্লেট ডিরেক্টরি থেকে টেমপ্লেট লোড করা
router.get('/', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        // ক্যাটেগরি অনুযায়ী টেমপ্লেট লোড করা
        const categories = ['basic', 'interactive', 'media', 'buttons', 'data', 'http', 'advanced'];
        const templates = {};

        for (const category of categories) {
            try {
                const categoryPath = path.join(templatesDir, `${category}.json`);
                const data = await fs.readFile(categoryPath, 'utf8');
                templates[category] = JSON.parse(data);
            } catch (error) {
                console.log(`No templates found for category: ${category}`);
                // ডিফল্ট টেমপ্লেটস
                templates[category] = getDefaultTemplates(category);
            }
        }

        res.json({
            success: true,
            templates: templates
        });
    } catch (error) {
        console.error('Template loading error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load templates'
        });
    }
});

// ডিফল্ট টেমপ্লেটস
function getDefaultTemplates(category) {
    const defaultTemplates = {
        basic: [
            {
                "name": "Welcome Message",
                "patterns": "/start, start, hello",
                "code": "const user = getUser();\nconst chatId = getChatId();\n\nbot.sendMessage(chatId, `🎉 Hello ${user.first_name}! Welcome to our bot!\\n\\n🤖 I can help you with:\\n/start - Show this welcome message\\n/help - Get help\\n/info - Bot information\\n\\nChoose a command or type your message!`);",
                "description": "Simple welcome message with user info"
            },
            {
                "name": "Help Command",
                "patterns": "/help, help, commands",
                "code": "const commands = [\n    \"/start - Welcome message\",\n    \"/help - Show this help\", \n    \"/info - Bot information\",\n    \"/echo - Repeat your message\"\n].join('\\n');\n\nbot.sendMessage(getChatId(), `🤖 **Available Commands:**\\n\\n${commands}`);",
                "description": "Display available commands"
            }
        ],
        interactive: [
            {
                "name": "Interactive Conversation",
                "patterns": "/conversation, chat, talk",
                "code": "bot.sendMessage(getChatId(), \"Let's have a conversation! What's your name?\");\n\n// Enable Wait for Answer and use this in Answer Handler:\nconst userName = getUserResponse();\nbot.sendMessage(getChatId(), `Nice to meet you, ${userName}! How can I help you today?`);",
                "description": "Multiple questions with wait for answer",
                "waitForAnswer": true
            }
        ],
        media: [
            {
                "name": "Send Photo",
                "patterns": "/photo, picture, image",
                "code": "// Send photo with caption\nbot.sendPhoto(getChatId(), 'https://example.com/image.jpg', {\n    caption: \"Here's your requested image! 📸\"\n});",
                "description": "Send image with caption"
            }
        ],
        buttons: [
            {
                "name": "Inline Buttons",
                "patterns": "/buttons, menu, options",
                "code": "bot.sendMessage(getChatId(), \"Choose an option:\", {\n    reply_markup: {\n        inline_keyboard: [\n            [\n                { text: \"📊 Profile\", callback_data: \"profile\" },\n                { text: \"⚙️ Settings\", callback_data: \"settings\" }\n            ],\n            [\n                { text: \"📞 Contact\", callback_data: \"contact\" },\n                { text: \"ℹ️ About\", callback_data: \"about\" }\n            ]\n        ]\n    }\n});",
                "description": "Message with inline keyboard buttons"
            }
        ],
        data: [
            {
                "name": "User Data Storage",
                "patterns": "/save, store, data",
                "code": "// Save user data\nconst userData = {\n    name: \"John Doe\",\n    preferences: { theme: \"dark\" },\n    lastActive: new Date().toISOString()\n};\n\nUser.saveData('profile', userData);\n\n// Retrieve user data\nconst savedData = User.getData('profile') || {};\nbot.sendMessage(getChatId(), `Your data: ${JSON.stringify(savedData)}`);",
                "description": "Save and retrieve user data"
            }
        ],
        http: [
            {
                "name": "HTTP Request",
                "patterns": "/weather, forecast",
                "code": "// Make HTTP request to weather API\nconst response = await HTTP.get('https://api.openweathermap.org/data/2.5/weather?q=London&appid=YOUR_API_KEY');\nconst data = JSON.parse(response);\n\nbot.sendMessage(getChatId(), `Weather in ${data.name}: ${data.weather[0].description}`);",
                "description": "Make HTTP requests to external APIs"
            }
        ],
        advanced: [
            {
                "name": "Error Handling",
                "patterns": "/test, debug",
                "code": "try {\n    // Your code here\n    const result = await someAsyncFunction();\n    bot.sendMessage(getChatId(), `Success: ${result}`);\n} catch (error) {\n    bot.sendMessage(getChatId(), `Error: ${error.message}`);\n    console.error('Command error:', error);\n}",
                "description": "Advanced error handling example"
            }
        ]
    };

    return defaultTemplates[category] || [];
}

module.exports = router;