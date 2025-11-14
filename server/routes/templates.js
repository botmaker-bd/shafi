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
            console.log('📁 Templates directory not found, creating...');
            await fs.mkdir(templatesDir, { recursive: true });
            
            // Create default template files
            const defaultTemplates = {
                'basic.json': [
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
                ]
            };

            for (const [filename, content] of Object.entries(defaultTemplates)) {
                await fs.writeFile(
                    path.join(templatesDir, filename),
                    JSON.stringify(content, null, 2)
                );
            }
        }

        const templates = {};

        // Read all files in templates directory
        const files = await fs.readdir(templatesDir);
        
        // Filter only .json files and extract category names
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        console.log(`📁 Found ${jsonFiles.length} template files:`, jsonFiles);

        for (const file of jsonFiles) {
            try {
                const category = file.replace('.json', '');
                const filePath = path.join(templatesDir, file);
                const data = await fs.readFile(filePath, 'utf8');
                const parsedData = JSON.parse(data);
                
                if (Array.isArray(parsedData)) {
                    templates[category] = parsedData;
                    console.log(`✅ Loaded ${parsedData.length} templates from ${file}`);
                } else {
                    console.log(`⚠️ Invalid template format in ${file}, expected array`);
                }
            } catch (error) {
                console.log(`❌ Error loading template file: ${file}`, error.message);
            }
        }

        res.json({
            success: true,
            templates: templates,
            totalCategories: Object.keys(templates).length
        });
    } catch (error) {
        console.error('❌ Template loading error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load templates: ' + error.message
        });
    }
});

module.exports = router;