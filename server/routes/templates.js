const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();

// Get all templates
router.get('/', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        // Check if templates directory exists
        try {
            await fs.access(templatesDir);
        } catch (error) {
            console.log('📁 Templates directory not found, creating...');
            await createDefaultTemplates();
        }

        // Read all template files
        const files = await fs.readdir(templatesDir);
        const templates = {};

        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        console.log(`📊 Found ${jsonFiles.length} template files:`, jsonFiles);

        if (jsonFiles.length === 0) {
            console.log('📝 No template files found, creating default templates...');
            await createDefaultTemplates();
            // Retry after creating default templates
            const newFiles = await fs.readdir(templatesDir);
            jsonFiles.push(...newFiles.filter(file => file.endsWith('.json')));
        }

        for (const file of jsonFiles) {
            try {
                const categoryName = file.replace('.json', '');
                const filePath = path.join(templatesDir, file);
                const data = await fs.readFile(filePath, 'utf8');
                const templateData = JSON.parse(data);
                
                // Validate template structure
                if (Array.isArray(templateData)) {
                    // server/routes/templates.js - improved validation
const validTemplates = templateData.filter(template => {
    if (!template || typeof template !== 'object') return false;
    
    // Required fields
    const hasRequired = template.name && template.patterns && template.code;
    if (!hasRequired) return false;
    
    // Auto-generate ID if missing
    if (!template.id) {
        template.id = `auto_${categoryName}_${Math.random().toString(36).substring(2, 9)}`;
    }
    
    // Set default values for optional fields
    if (template.waitForAnswer === undefined) {
        template.waitForAnswer = false;
    }
    if (!template.answerHandler) {
        template.answerHandler = '';
    }
    if (!template.description) {
        template.description = `${template.name} template`;
    }
    
    return true;
});
                    
                    templates[categoryName] = validTemplates;
                    console.log(`✅ Loaded ${validTemplates.length} templates from ${categoryName}`);
                } else {
                    console.warn(`⚠️ Invalid template format in ${file}, expected array`);
                    templates[categoryName] = [];
                }
            } catch (error) {
                console.error(`❌ Error loading template file ${file}:`, error.message);
                templates[file.replace('.json', '')] = [];
            }
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
        console.error('❌ Template loading error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load templates',
            details: error.message
        });
    }
});

// Get templates by category
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const templatesDir = path.join(__dirname, '../templates');
        const filePath = path.join(templatesDir, `${category}.json`);

        try {
            await fs.access(filePath);
        } catch (error) {
            return res.status(404).json({
                success: false,
                error: `Template category '${category}' not found`
            });
        }

        const data = await fs.readFile(filePath, 'utf8');
        const templates = JSON.parse(data);

        res.json({
            success: true,
            category: category,
            templates: templates
        });

    } catch (error) {
        console.error(`❌ Get template category error (${req.params.category}):`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to load template category'
        });
    }
});

// Helper function to create default templates
async function createDefaultTemplates() {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        // Create templates directory
        await fs.mkdir(templatesDir, { recursive: true });
        
        // Create basic templates
        await fs.writeFile(
            path.join(templatesDir, 'basic.json'), 
            JSON.stringify([
                {
                    "id": "default_welcome",
                    "name": "Default Welcome",
                    "patterns": "/start, start",
                    "description": "Basic welcome message template",
                    "code": "// Default welcome message\\nconst user = getUser();\\nbot.sendMessage(`Welcome ${user.first_name}! This is your new bot. 🚀`);",
                    "waitForAnswer": false,
                    "answerHandler": ""
                }
            ], null, 2)
        );

        // Create interactive templates
        await fs.writeFile(
            path.join(templatesDir, 'interactive.json'), 
            JSON.stringify([
                {
                    "id": "default_conversation",
                    "name": "Simple Conversation",
                    "patterns": "/chat, talk",
                    "description": "Basic interactive conversation",
                    "code": "// Simple conversation template\\nconst name = await waitForAnswer(\\\"What's your name?\\\");\\nawait bot.sendMessage(`Hello ${name}! Nice to meet you!`);",
                    "waitForAnswer": true,
                    "answerHandler": "// Handle user's answer\\nconst userInput = params;\\nbot.sendMessage(`Thanks for your answer: ${userInput}`);"
                }
            ], null, 2)
        );

        console.log('✅ Default templates created successfully');
    } catch (error) {
        console.error('❌ Error creating default templates:', error);
        throw error;
    }
}

module.exports = router;