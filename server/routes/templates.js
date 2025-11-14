const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Get all templates
router.get('/', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        // Check if templates directory exists
        try {
            await fs.access(templatesDir);
        } catch (error) {
            console.log('Templates directory not found, creating default templates...');
            await createDefaultTemplates();
        }

        // Read all files in templates directory
        const files = await fs.readdir(templatesDir);
        const templates = {};

        // Filter and process only JSON files
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        console.log(`Found ${jsonFiles.length} template files:`, jsonFiles);

        if (jsonFiles.length === 0) {
            console.log('No template files found, creating default templates...');
            await createDefaultTemplates();
            // Retry after creating default templates
            return router.get('/', req, res);
        }

        for (const file of jsonFiles) {
            try {
                const categoryName = file.replace('.json', '');
                const filePath = path.join(templatesDir, file);
                const data = await fs.readFile(filePath, 'utf8');
                const templateData = JSON.parse(data);
                
                templates[categoryName] = Array.isArray(templateData) ? templateData : [templateData];
                
                console.log(`✅ Loaded ${templates[categoryName].length} templates from ${categoryName}`);
            } catch (error) {
                console.error(`❌ Error loading template file ${file}:`, error);
                // Continue with other files even if one fails
            }
        }

        // Ensure we have at least basic templates
        if (!templates.basic || templates.basic.length === 0) {
            console.log('Creating basic templates...');
            templates.basic = await createBasicTemplates();
        }

        res.json({
            success: true,
            templates: templates,
            stats: {
                totalCategories: Object.keys(templates).length,
                totalTemplates: Object.values(templates).reduce((sum, arr) => sum + arr.length, 0)
            }
        });

    } catch (error) {
        console.error('Template loading error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load templates',
            details: error.message
        });
    }
});

// Helper function to create default templates
async function createDefaultTemplates() {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        // Create templates directory if it doesn't exist
        await fs.mkdir(templatesDir, { recursive: true });
        
        // Create basic templates
        await createBasicTemplatesFile();
        
        // Create interactive templates
        await createInteractiveTemplatesFile();
        
        // Create media templates  
        await createMediaTemplatesFile();
        
        console.log('✅ Default templates created successfully');
    } catch (error) {
        console.error('❌ Error creating default templates:', error);
    }
}

async function createBasicTemplatesFile() {
    const templatesDir = path.join(__dirname, '../templates');
    const basicTemplates = [
        {
            "id": "welcome",
            "name": "Welcome Message",
            "patterns": "/start, start, hello, hi",
            "code": `// Welcome message template
const user = getUser();
const welcomeMessage = \`Hello \${user.first_name}! 👋

Welcome to our bot! Here's what you can do:
• Use /help to see all commands
• Use /info to get bot information

Your User ID: \${user.id}
Username: @\${user.username || 'Not set'}\`;

bot.sendMessage(welcomeMessage, {
    parse_mode: 'Markdown'
});`,
            "description": "Simple welcome message with user info",
            "waitForAnswer": false
        },
        {
            "id": "help",
            "name": "Help Command", 
            "patterns": "/help, help, commands, menu",
            "code": `// Help command template
const helpText = \`🤖 *Bot Help Menu*

*Available Commands:*
• /start - Start the bot
• /help - Show this help message  
• /info - Bot information

*Features:*
• Multiple command patterns
• Interactive conversations
• Media support
• Python code execution

*Need Help?*
Contact support if you need assistance.\`;

bot.sendMessage(helpText, {
    parse_mode: 'Markdown'
});`,
            "description": "Display available commands and features",
            "waitForAnswer": false
        },
        {
            "id": "echo",
            "name": "Echo Command",
            "patterns": "/echo, repeat, say",
            "code": `// Echo command template
const userInput = params || message.text.replace('/echo', '').trim();

if (!userInput) {
    return bot.sendMessage("Please provide some text for me to echo.\\nUsage: /echo your message");
}

bot.sendMessage(\`🔊 Echo: \${userInput}\`);`,
            "description": "Repeat user's message back",
            "waitForAnswer": false
        }
    ];

    await fs.writeFile(
        path.join(templatesDir, 'basic.json'), 
        JSON.stringify(basicTemplates, null, 2)
    );
}

async function createInteractiveTemplatesFile() {
    const templatesDir = path.join(__dirname, '../templates');
    const interactiveTemplates = [
        {
            "id": "conversation",
            "name": "Interactive Conversation",
            "patterns": "/conversation, chat, talk",
            "code": `// Interactive conversation template
const user = getUser();

// Ask for user's name
const name = await waitForAnswer("What's your name?");
await bot.sendMessage(\`Nice to meet you, \${name}! 👋\`);

// Ask for favorite color
const color = await waitForAnswer("What's your favorite color?");
await bot.sendMessage(\`\${color} is a great choice! 🎨\`);

// Ask for age
const age = await waitForAnswer("How old are you?");
await bot.sendMessage(\`Thanks for sharing! \${name}, \${age}, favorite color: \${color} - got it! ✅\`);`,
            "description": "Multiple questions with wait for answer",
            "waitForAnswer": true,
            "answerHandler": `// Answer handler for conversation
const lastQuestion = User.getData('last_question');

if (lastQuestion === 'name') {
    User.saveData('user_name', userInput);
    User.saveData('last_question', 'color');
} else if (lastQuestion === 'color') {
    User.saveData('favorite_color', userInput);
    User.saveData('last_question', 'age');
} else if (lastQuestion === 'age') {
    User.saveData('user_age', userInput);
    User.saveData('last_question', null);
}`
        },
        {
            "id": "feedback",
            "name": "Feedback System",
            "patterns": "/feedback, rate, review",
            "code": `// Feedback system template
await bot.sendMessage("We'd love to hear your feedback! 💬\\n\\nHow would you rate your experience (1-5 stars)?", {
    reply_markup: {
        inline_keyboard: [
            [
                { text: "⭐", callback_data: "rate_1" },
                { text: "⭐⭐", callback_data: "rate_2" },
                { text: "⭐⭐⭐", callback_data: "rate_3" },
                { text: "⭐⭐⭐⭐", callback_data: "rate_4" },
                { text: "⭐⭐⭐⭐⭐", callback_data: "rate_5" }
            ]
        ]
    }
});`,
            "description": "Collect user feedback and ratings",
            "waitForAnswer": false
        }
    ];

    await fs.writeFile(
        path.join(templatesDir, 'interactive.json'), 
        JSON.stringify(interactiveTemplates, null, 2)
    );
}

async function createMediaTemplatesFile() {
    const templatesDir = path.join(__dirname, '../templates');
    const mediaTemplates = [
        {
            "id": "send_photo",
            "name": "Send Photo",
            "patterns": "/photo, picture, image",
            "code": `// Send photo template
// Replace with your actual photo URL or file path
const photoUrl = 'https://example.com/photo.jpg';

await bot.sendPhoto(photoUrl, {
    caption: "Here's a beautiful photo! 📸",
    parse_mode: 'Markdown'
});`,
            "description": "Send image with caption",
            "waitForAnswer": false
        },
        {
            "id": "send_document",
            "name": "Send Document",
            "patterns": "/document, file, doc",
            "code": `// Send document template
// Replace with your actual document URL or file path
const documentUrl = 'https://example.com/document.pdf';

await bot.sendDocument(documentUrl, {
    caption: "Here's the document you requested! 📄",
    parse_mode: 'Markdown'
});`,
            "description": "Send file/document to user",
            "waitForAnswer": false
        }
    ];

    await fs.writeFile(
        path.join(templatesDir, 'media.json'), 
        JSON.stringify(mediaTemplates, null, 2)
    );
}

// Fallback function if no templates are found
async function createBasicTemplates() {
    return [
        {
            "id": "default_welcome",
            "name": "Default Welcome",
            "patterns": "/start, start",
            "code": `// Default welcome message
const user = getUser();
bot.sendMessage(\`Welcome \${user.first_name}! This is your new bot. 🚀\`);`,
            "description": "Basic welcome message",
            "waitForAnswer": false
        }
    ];
}

module.exports = router;