const path = require('path');

class TemplateLoader {
    constructor() {
        this.templates = new Map();
        this.loadTemplates();
    }

    loadTemplates() {
        try {
            // Basic templates
            this.templates.set('basic', require('../templates/basic-templates'));
            this.templates.set('python', require('../templates/python-templates'));
            this.templates.set('ai', require('../templates/ai-templates'));
            
            console.log('✅ Templates loaded successfully');
        } catch (error) {
            console.error('❌ Template loading error:', error);
        }
    }

    getTemplate(category, templateName) {
        const categoryTemplates = this.templates.get(category);
        return categoryTemplates ? categoryTemplates[templateName] : null;
    }

    getAllTemplates() {
        const allTemplates = {};
        this.templates.forEach((categoryTemplates, categoryName) => {
            allTemplates[categoryName] = categoryTemplates;
        });
        return allTemplates;
    }
}

module.exports = new TemplateLoader();