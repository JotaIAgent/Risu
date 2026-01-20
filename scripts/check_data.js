
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env manually to avoid npm install issues
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../.env')

let supabaseUrl = ''
let supabaseKey = ''

try {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length >= 2) {
            const key = parts[0].trim()
            const val = parts.slice(1).join('=').trim()
            if (key === 'VITE_SUPABASE_URL') supabaseUrl = val
            if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val
        }
    })
} catch (e) {
    console.error('Error reading .env:', e.message)
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkCounts() {
    console.log('--- Checking DB Counts ---')

    const tables = ['rentals', 'customers', 'items', 'rental_items']

    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })

        if (error) {
            console.error(`Error counting ${table}:`, error.message)
        } else {
            console.log(`${table}: ${count} rows`)
        }
    }

    // Check recent rentals (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { count: recentRentals, error: recentError } = await supabase
        .from('rentals')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString())

    if (!recentError) {
        console.log(`Rentals (Last 30 days): ${recentRentals}`)
    } else {
        console.error('Error checking recent rentals:', recentError.message)
    }
}

checkCounts()
