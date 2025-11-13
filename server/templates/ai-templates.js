module.exports = {
    ai_welcome: {
        name: "AI Welcome Message",
        patterns: "/aiwelcome,smartwelcome",
        code: `// AI-powered welcome message
const user = getUser();
const welcomeText = \`🎉 Hello \${user.first_name}! 

I'm your AI-powered assistant 🤖
I can help you with Python, web scraping, and more!

Your ID: \${user.id}\`;

bot.sendMessage(welcomeText);`
    }
};