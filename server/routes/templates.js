const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Get all templates - Auto load categories from filesystem
router.get('/', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        // Check if templates directory exists
        try {
            await fs.access(templatesDir);
        } catch (error) {
            console.error('❌ Templates directory not found:', templatesDir);
            return res.status(500).json({
                success: false,
                error: 'Templates directory not found'
            });
        }

        // Read all files in templates directory
        const files = await fs.readdir(templatesDir);
        
        // Filter JSON files and extract categories
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        const categories = jsonFiles.map(file => file.replace('.json', ''));
        
        console.log(`📁 Found ${categories.length} template categories:`, categories);

        const templates = {};

        // Load each category file
        for (const category of categories) {
            try {
                const categoryPath = path.join(templatesDir, `${category}.json`);
                const data = await fs.readFile(categoryPath, 'utf8');
                const categoryTemplates = JSON.parse(data);
                
                // Validate template structure
                if (Array.isArray(categoryTemplates)) {
                    templates[category] = categoryTemplates;
                    console.log(`✅ Loaded ${categoryTemplates.length} templates from ${category}.json`);
                } else {
                    console.warn(`⚠️ Invalid template format in ${category}.json - expected array`);
                    templates[category] = [];
                }
            } catch (error) {
                console.error(`❌ Error loading ${category}.json:`, error.message);
                templates[category] = [];
            }
        }

        // Sort categories for consistent order
        const sortedTemplates = {};
        categories.sort().forEach(category => {
            if (templates[category]) {
                sortedTemplates[category] = templates[category];
            }
        });

        res.json({
            success: true,
            templates: sortedTemplates,
            categories: categories,
            totalCategories: categories.length,
            totalTemplates: Object.values(templates).reduce((sum, arr) => sum + arr.length, 0)
        });

    } catch (error) {
        console.error('❌ Template loading error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load templates: ' + error.message
        });
    }
});

// Get specific category templates
router.get('/:category', async (req, res) => {
    try {
        const { category } = req.params;
        const templatesDir = path.join(__dirname, '../templates');
        const categoryPath = path.join(templatesDir, `${category}.json`);

        try {
            const data = await fs.readFile(categoryPath, 'utf8');
            const templates = JSON.parse(data);
            
            res.json({
                success: true,
                category: category,
                templates: templates,
                count: templates.length
            });
        } catch (error) {
            console.error(`❌ Category ${category} not found:`, error.message);
            res.status(404).json({
                success: false,
                error: `Category '${category}' not found`
            });
        }

    } catch (error) {
        console.error('❌ Category loading error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load category: ' + error.message
        });
    }
});

// Get available categories
router.get('/meta/categories', async (req, res) => {
    try {
        const templatesDir = path.join(__dirname, '../templates');
        
        try {
            await fs.access(templatesDir);
        } catch (error) {
            return res.json({
                success: true,
                categories: [],
                message: 'Templates directory not found'
            });
        }

        const files = await fs.readdir(templatesDir);
        const categories = files
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''))
            .sort();

        res.json({
            success: true,
            categories: categories,
            count: categories.length
        });

    } catch (error) {
        console.error('❌ Categories meta error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load categories'
        });
    }
});

module.exports = router;