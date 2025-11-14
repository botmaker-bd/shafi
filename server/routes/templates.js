const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Get all templates
router.get('/', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../templates');
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
                templates[category] = JSON.parse(data);
                console.log(`✅ Loaded ${templates[category].length} templates from ${file}`);
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
            error: 'Failed to load templates'
        });
    }
});

module.exports = router;