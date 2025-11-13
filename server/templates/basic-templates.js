module.exports = {
    welcome_bot_style: {
        name: "Welcome Message (bot style)",
        patterns: "/start,start,hello,hi",
        code: `// Welcome message using bot style
const user = getUser();
bot.sendMessage(\`Hello \${user.first_name}! 👋

Welcome to our bot! Here's what you can do:
• Use /help to see all commands
• Use /info to get bot information

Your User ID: \${user.id}
Username: @\${user.username || 'Not set'}\`);`
    },

    welcome_api_style: {
        name: "Welcome Message (Api style)", 
        patterns: "/start2,start2",
        code: `// Welcome message using Api style
const user = Api.getUser();
Api.sendMessage(\`Hello \${user.first_name}! 👋

Welcome to our bot! Here's what you can do:
• Use /help to see all commands  
• Use /info to get bot information

Your User ID: \${user.id}
Username: @\${user.username || 'Not set'}\`);`
    },

    buttons_bot_style: {
        name: "Inline Buttons (bot style)",
        patterns: "/buttons,menu,options",
        code: `// Inline buttons using bot style
bot.sendMessage("Choose an option:", {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "✅ Option 1", callback_data: "option_1" },
                { text: "🔍 Option 2", callback_data: "option_2" }
            ],
            [
                { text: "📞 Contact", url: "https://t.me/username" },
                { text: "🌐 Website", url: "https://example.com" }
            ]
        ]
    }
});`
    },

    buttons_api_style: {
        name: "Inline Buttons (Api style)",
        patterns: "/buttons2,menu2",
        code: `// Inline buttons using Api style
Api.sendKeyboard("Choose an option:", [
    [
        { text: "✅ Option 1", callback_data: "option_1" },
        { text: "🔍 Option 2", callback_data: "option_2" }
    ],
    [
        { text: "📞 Contact", url: "https://t.me/username" },
        { text: "🌐 Website", url: "https://example.com" }
    ]
]);`
    },

    media_bot_style: {
        name: "Send Media (bot style)",
        patterns: "/photo,image,pic",
        code: `// Send photo using bot style
bot.sendPhoto("https://via.placeholder.com/400x300", {
    caption: "📸 Here's a beautiful image for you!",
    parse_mode: "Markdown"
});`
    },

    media_api_style: {
        name: "Send Media (Api style)", 
        patterns: "/photo2,image2",
        code: `// Send photo using Api style
Api.sendImage("https://via.placeholder.com/400x300", "📸 Here's a beautiful image for you!");`
    }
};