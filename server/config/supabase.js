const { createClient } = require('@supabase/supabase-js');

// Configuration with fallbacks
const supabaseUrl = process.env.SUPABASE_URL || 'https://tyoaazgsoqvubgfychmd.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5b2Fhemdzb3F2dWJnZnljaG1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NTE0NDQsImV4cCI6MjA3ODMyNzQ0NH0.czWc-rOitmnn31iAvgTEvZj7bW-aJ2ysFymoWJ8UZCc';

// Validate configuration
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase configuration missing!');
    console.error('Please set SUPABASE_URL and SUPABASE_KEY environment variables');
    process.exit(1);
}

// Create Supabase client with enhanced configuration
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'X-Client-Info': 'telegram-bot-platform@2.0.0'
        }
    }
});

// Test connection on startup
(async () => {
    try {
        const { data, error } = await supabase.from('universal_data').select('count').limit(1);
        if (error) {
            console.error('❌ Supabase connection test failed:', error.message);
        } else {
            console.log('✅ Supabase connected successfully');
        }
    } catch (error) {
        console.error('❌ Supabase connection error:', error.message);
    }
})();

module.exports = supabase;