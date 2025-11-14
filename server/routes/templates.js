const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Get all templates
router.get('/', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        // Define template categories (updated with python)
        const categories = ['basic', 'interactive', 'media', 'buttons', 'data', 'http', 'advanced', 'python'];
        const templates = {};

        for (const category of categories) {
            try {
                const categoryPath = path.join(templatesDir, `${category}.json`);
                const data = await fs.readFile(categoryPath, 'utf8');
                templates[category] = JSON.parse(data);
                console.log(`✅ Loaded ${templates[category].length} templates from ${category}.json`);
            } catch (error) {
                console.log(`❌ No templates found for category: ${category}`, error.message);
                templates[category] = [];
            }
        }

        res.json({
            success: true,
            templates: templates
        });
    } catch (error) {
        console.error('❌ Template loading error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load templates'
        });
    }
});

module.exports = router;