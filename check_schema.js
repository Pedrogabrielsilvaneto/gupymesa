const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
    console.log("--- Schema Info ---");
    const tables = ['usuarios', 'producao', 'assertividade', 'checkin_diario', 'metas', 'config_mes'];
    for (const table of tables) {
        console.log(`Checking table: ${table}`);
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.error(`Error checking ${table}:`, error.message);
        } else if (data && data.length > 0) {
            console.log(`Columns for ${table}:`, Object.keys(data[0]).join(', '));
        } else {
            console.log(`Table ${table} is empty or not accessible.`);
        }
    }
}

run();
