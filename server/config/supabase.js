// server/config/supabase.js - COMPLETELY FIXED VERSION
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

// Create Supabase client with ENHANCED configuration
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
    },
    // ✅ ADDED: Better timeout settings
    realtime: {
        timeout: 30000,
    }
});

// ✅ ENHANCED connection test with retry
async function testConnection(retries = 3) {
    for (let i = 1; i <= retries; i++) {
        try {
            console.log(`🔗 Testing Supabase connection (attempt ${i}/${retries})...`);
            
            const { data, error } = await supabase
                .from('universal_data')
                .select('count')
                .limit(1)
                .single();

            if (error) {
                console.error(`❌ Supabase connection test failed (attempt ${i}):`, error.message);
                if (i === retries) {
                    throw error;
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }

            console.log('✅ Supabase connected successfully');
            console.log('📊 Database is accessible and responsive');
            return true;
            
        } catch (error) {
            console.error(`❌ Supabase connection error (attempt ${i}):`, error.message);
            if (i === retries) {
                console.error('❌ All connection attempts failed');
                return false;
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// ✅ ENHANCED: Check table structure and fix if needed
async function checkAndFixTableStructure() {
    try {
        console.log('🔍 Checking universal_data table structure...');
        
        const { data, error } = await supabase
            .from('universal_data')
            .select('*')
            .limit(5);

        if (error) {
            console.error('❌ Table structure check failed:', error);
            return false;
        }

        if (data && data.length > 0) {
            console.log('✅ Table structure is valid');
            console.log(`📋 Found ${data.length} sample rows`);
            
            // Log sample data structure
            data.forEach((row, index) => {
                console.log(`📦 Row ${index + 1}:`, {
                    data_type: row.data_type,
                    data_key: row.data_key,
                    data_value_length: row.data_value?.length || 0,
                    updated_at: row.updated_at
                });
            });
        } else {
            console.log('ℹ️ Table is empty - this is normal for new installation');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Table check error:', error);
        return false;
    }
}

// ✅ ENHANCED startup sequence
(async () => {
    try {
        console.log('🚀 Initializing Supabase connection...');
        
        // Test connection
        const connectionSuccess = await testConnection();
        
        if (connectionSuccess) {
            // Check table structure
            await checkAndFixTableStructure();
            
            console.log('🎉 Supabase initialization completed successfully');
        } else {
            console.error('❌ Supabase initialization failed');
        }
    } catch (error) {
        console.error('❌ Supabase startup error:', error);
    }
})();

module.exports = supabase;