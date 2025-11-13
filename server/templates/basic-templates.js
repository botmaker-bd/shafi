module.exports = {
    welcome_bot: {
        name: "Welcome Message (bot style)",
        patterns: "/start,start,hello,hi",
        code: `// Welcome message using bot style
const user = getUser();
bot.sendMessage(\`Hello \${user.first_name}! 👋 Welcome to our bot!\`);`
    },

    welcome_api: {
        name: "Welcome Message (Api style)", 
        patterns: "/start2,start2",
        code: `// Welcome message using Api style
const user = Api.getUser();
Api.sendMessage(\`Hello \${user.first_name}! 👋 Welcome to our bot!\`);`
    },

    buttons_bot: {
        name: "Inline Buttons (bot style)",
        patterns: "/buttons,menu,options",
        code: `// Inline buttons using bot style
bot.sendMessage("Choose an option:", {
    reply_markup: {
        inline_keyboard: [
            [{ text: "Option 1", callback_data: "option_1" }],
            [{ text: "Option 2", callback_data: "option_2" }]
        ]
    }
});`
    },

    buttons_api: {
        name: "Inline Buttons (Api style)",
        patterns: "/buttons2,menu2",
        code: `// Inline buttons using Api style
Api.sendKeyboard("Choose an option:", [
    [{ text: "Option 1", callback_data: "option_1" }],
    [{ text: "Option 2", callback_data: "option_2" }]
]);`
    }
};