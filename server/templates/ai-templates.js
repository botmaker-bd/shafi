module.exports = {
    ai_welcome: {
        name: "AI Welcome Message",
        patterns: "/aiwelcome,smartwelcome",
        code: `// AI-powered welcome message
const user = getUser();
const welcomeText = \`🎉 Hello \${user.first_name}! 

I'm your AI-powered assistant 🤖
I can help you with:

• 📊 Data analysis with Python
• 🌐 Web scraping and APIs  
• 🤖 Machine learning tasks
• 💬 Smart conversations

Try these commands:
/calc - Python calculator
/scrape - Web data scraping
/ai - AI code generation

Your ID: \${user.id}\`;

// Both styles work:
bot.sendMessage(welcomeText);
// OR: Api.sendMessage(welcomeText);`
    },

    ai_conversation: {
        name: "AI Conversation Starter",
        patterns: "/chat,talk,converse",
        code: `// AI conversation starter
bot.sendMessage("🤖 I'm an AI assistant! What would you like to do?", {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "🧮 Calculate", callback_data: "ai_calc" },
                { text: "🌐 Web Data", callback_data: "ai_web" }
            ],
            [
                { text: "🤖 AI Tasks", callback_data: "ai_tasks" },
                { text: "📊 Analysis", callback_data: "ai_analysis" }
            ]
        ]
    }
});

// Handle callback
const answer = await bot.waitForAnswer("Choose an option or type your request:");
bot.sendMessage(\`You selected: \${answer}\`);`
    },

    code_generator: {
        name: "AI Code Generator",
        patterns: "/generate,makecode",
        code: `// AI code generation example
const userRequest = await bot.waitForAnswer("What code do you want me to generate?");
const generatedCode = \`// Generated code for: "\${userRequest}"
const user = getUser();
bot.sendMessage(\`Hello \${user.first_name}! I generated code for: "\${userRequest}"\`);

// You can add Python execution too:
// const pythonResult = await bot.runPython(\`print("Hello from Python!")\`);
\`;

bot.sendMessage(\`🤖 Generated Code:\\n\\n\\\`\\\`\\\`javascript\\n\${generatedCode}\\n\\\`\\\`\\\`\`, {
    parse_mode: "Markdown"
});`
    }
};