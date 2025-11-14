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

// Enhanced Supabase client configuration
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'X-Client-Info': 'telegram-bot-platform@2.0.0',
            'X-Application-Name': 'bot-maker-pro'
        }
    },
    realtime: {
        params: {
            eventsPerSecond: 10
        }
    }
});

// Enhanced connection test with retry mechanism
async function testConnection(maxRetries = 3, retryDelay = 2000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔗 Testing Supabase connection (attempt ${attempt}/${maxRetries})...`);
            
            const { data, error, status } = await supabase
                .from('universal_data')
                .select('count')
                .limit(1)
                .single();

            if (error) {
                // If it's a "relation does not exist" error, that's okay for initial setup
                if (error.code === 'PGRST204' || error.code === '42P01') {
                    console.log('⚠️  Database tables not initialized yet. This is normal for first setup.');
                    return { success: true, initialized: false };
                }
                
                lastError = error;
                console.error(`❌ Supabase connection attempt ${attempt} failed:`, error.message);
                
                if (attempt < maxRetries) {
                    console.log(`⏳ Retrying in ${retryDelay/1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue;
                }
            } else {
                console.log('✅ Supabase connected successfully');
                return { success: true, initialized: true, status };
            }
        } catch (error) {
            lastError = error;
            console.error(`❌ Supabase connection attempt ${attempt} error:`, error.message);
            
            if (attempt < maxRetries) {
                console.log(`⏳ Retrying in ${retryDelay/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
    }
    
    console.error('❌ All Supabase connection attempts failed');
    return { success: false, error: lastError };
}

// Validate database schema on startup
async function validateDatabaseSchema() {
    try {
        console.log('🔍 Validating database schema...');
        
        const requiredTables = ['users', 'bots', 'commands', 'universal_data', 'user_sessions'];
        const schemaStatus = {};
        
        for (const table of requiredTables) {
            try {
                const { error } = await supabase
                    .from(table)
                    .select('*')
                    .limit(1);
                
                if (error) {
                    if (error.code === 'PGRST204' || error.code === '42P01') {
                        schemaStatus[table] = 'missing';
                        console.warn(`⚠️  Table '${table}' not found`);
                    } else {
                        schemaStatus[table] = 'error';
                        console.error(`❌ Table '${table}' access error:`, error.message);
                    }
                } else {
                    schemaStatus[table] = 'ok';
                    console.log(`✅ Table '${table}' accessible`);
                }
            } catch (tableError) {
                schemaStatus[table] = 'error';
                console.error(`❌ Table '${table}' validation error:`, tableError.message);
            }
        }
        
        return schemaStatus;
    } catch (error) {
        console.error('❌ Database schema validation failed:', error);
        return null;
    }
}

// Initialize database connection
async function initializeDatabase() {
    try {
        console.log('🚀 Initializing database connection...');
        
        // Test connection
        const connectionResult = await testConnection();
        if (!connectionResult.success) {
            throw new Error(`Database connection failed: ${connectionResult.error?.message || 'Unknown error'}`);
        }
        
        // Validate schema
        const schemaStatus = await validateDatabaseSchema();
        
        console.log('📊 Database initialization completed:');
        console.log(`   - Connection: ${connectionResult.success ? '✅ OK' : '❌ Failed'}`);
        console.log(`   - Tables initialized: ${connectionResult.initialized ? '✅ Yes' : '⚠️  No (first setup)'}`);
        
        if (schemaStatus) {
            const okTables = Object.values(schemaStatus).filter(status => status === 'ok').length;
            const totalTables = Object.keys(schemaStatus).length;
            console.log(`   - Tables accessible: ${okTables}/${totalTables}`);
        }
        
        return {
            connected: connectionResult.success,
            initialized: connectionResult.initialized,
            schemaStatus
        };
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        
        // Don't crash the app for connection issues, but log heavily
        console.warn('⚠️  Application starting with limited database functionality');
        
        return {
            connected: false,
            initialized: false,
            error: error.message
        };
    }
}

// Health check function
async function healthCheck() {
    try {
        const startTime = Date.now();
        const { data, error, status } = await supabase
            .from('universal_data')
            .select('count')
            .limit(1)
            .single();
        
        const responseTime = Date.now() - startTime;
        
        return {
            status: error ? 'error' : 'healthy',
            responseTime: `${responseTime}ms`,
            databaseStatus: status,
            error: error ? error.message : null,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

// Enhanced query with error handling
supabase.safeQuery = async function(queryFunction, context = 'unknown') {
    try {
        const result = await queryFunction();
        
        if (result.error) {
            console.error(`❌ Database query error [${context}]:`, {
                message: result.error.message,
                code: result.error.code,
                details: result.error.details,
                hint: result.error.hint
            });
            
            // Log to error table if possible
            try {
                await supabase
                    .from('universal_data')
                    .insert({
                        data_type: 'error_log',
                        data_key: `query_error_${Date.now()}`,
                        data_value: JSON.stringify({
                            context,
                            error: result.error.message,
                            code: result.error.code,
                            timestamp: new Date().toISOString()
                        }),
                        metadata: {
                            type: 'database_error',
                            severity: 'high'
                        }
                    });
            } catch (logError) {
                // Silent fail for error logging
            }
        }
        
        return result;
    } catch (error) {
        console.error(`❌ Database operation failed [${context}]:`, error);
        return { error: { message: error.message, code: 'OPERATION_FAILED' } };
    }
};

// Initialize on module load
let initializationPromise = null;

function initialize() {
    if (!initializationPromise) {
        initializationPromise = initializeDatabase();
    }
    return initializationPromise;
}

// Auto-initialize but don't block module export
initialize().catch(error => {
    console.error('❌ Auto-initialization failed:', error);
});

// Export with enhanced functionality
module.exports = {
    supabase,
    initialize,
    healthCheck,
    testConnection,
    validateDatabaseSchema
};