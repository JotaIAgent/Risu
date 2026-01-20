import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load .env manually
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '../.env')

let supabaseUrl = ''
let supabaseKey = ''

let serviceRoleKey = ''

try {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
        const parts = line.split('=')
        if (parts.length >= 2) {
            const key = parts[0].trim()
            const val = parts.slice(1).join('=').trim()
            if (key === 'VITE_SUPABASE_URL') supabaseUrl = val
            if (key === 'VITE_SUPABASE_ANON_KEY') supabaseKey = val
            if (key === 'VITE_SUPABASE_SERVICE_ROLE_KEY') serviceRoleKey = val
        }
    })
} catch (e) {
    console.error('Error reading .env:', e.message)
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env')
    process.exit(1)
}

// Prefer Service Role for seeding to bypass RLS
const supabase = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createClient(supabaseUrl, supabaseKey)

if (serviceRoleKey) console.log('Using SERVICE_ROLE_KEY (Bypassing RLS)')
else console.log('Using ANON_KEY (RLS Enabled)')

async function seed() {
    console.log('--- STARTING SEED ---')

    let userId = null

    // If using Service Role, we still need a user_id to associate data with.
    // We can pick the first user from auth.users or create one.
    if (serviceRoleKey) {
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
        if (usersError) {
            console.error('Error listing users with service role key:', usersError.message)
            return
        }
        if (users && users.users.length > 0) {
            userId = users.users[0].id
            console.log(`Using existing admin user: ${userId}`)
        } else {
            console.log('No users found. Creating admin...')
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: 'admin@admin.com',
                password: 'password123',
                email_confirm: true
            })
            if (createError) {
                console.error('Failed to create admin:', createError)
                return
            }
            userId = newUser.user.id
            console.log(`Created admin user: ${userId}`)
        }
    } else {
        // ... Normal Auth Flow (Keep existing logic but ensure session is set)
        const email = 'admin@admin.com'
        const password = 'password123'

        // Try Sign In
        let { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

        if (signInData?.session) {
            console.log('Signed in as existing user.')
            userId = signInData.user.id
            await supabase.auth.setSession(signInData.session) // Ensure session is set
        } else {
            console.log('User not found, attempting sign up...')
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password })
            if (signUpError) {
                console.error('Auth failed:', signUpError.message)
                return
            }
            if (signUpData?.user) {
                console.log('User signed up.')
                userId = signUpData.user.id
                // IMPORTANT: In some envs, signUp might not auto-login if email confirm is required.
                // But Supabase defaults to "Enable Email Confirmations" = true?
                // If so, we can't seed without confirming email.
                // Unless we use SERVICE ROLE.
                if (signUpData.session) {
                    await supabase.auth.setSession(signUpData.session) // Ensure session is set
                } else {
                    console.log('Sign up successful but no session returned. Attempting sign in again...')
                    // Try signing in again to get a session if signUp didn't provide one
                    const { data: reSignInData, error: reSignInError } = await supabase.auth.signInWithPassword({ email, password })
                    if (reSignInData?.session) {
                        console.log('Successfully signed in after sign up.')
                        userId = reSignInData.user.id
                        await supabase.auth.setSession(reSignInData.session)
                    } else {
                        console.error('Could not sign in after sign up:', reSignInError?.message || 'Unknown error')
                        console.log('Current session status after sign up attempt:', await supabase.auth.getSession())
                        return
                    }
                }
            } else {
                console.error('Sign up successful but no user/session.')
                console.log('Current session status after sign up attempt:', await supabase.auth.getSession())
                return
            }
        }
    }

    if (!userId) {
        console.error('Could not obtain user_id.')
        return
    }

    // 1. Create Items
    // Schema: items(id, user_id, name, daily_price)
    const itemsData = [
        { user_id: userId, name: 'Cadeira Tiffany', daily_price: 15.00 },
        { user_id: userId, name: 'Mesa Redonda', daily_price: 45.00 },
        { user_id: userId, name: 'Toalha de Mesa', daily_price: 8.00 },
        { user_id: userId, name: 'Taça de Cristal', daily_price: 2.50 },
        { user_id: userId, name: 'Prato Porcelana', daily_price: 3.00 }
    ]

    const { data: items, error: itemsError } = await supabase.from('items').insert(itemsData).select()
    if (itemsError) return console.error('Error seeding items:', itemsError)
    console.log(`Created ${items.length} items`)

    // 2. Create Customers
    // Schema: customers(id, user_id, name, whatsapp)
    const customersData = [
        { user_id: userId, name: 'Maria Silva', whatsapp: '11999999999' },
        { user_id: userId, name: 'Buffet Delícias', whatsapp: '11988888888' },
        { user_id: userId, name: 'João Santos', whatsapp: '11977777777' }
    ]

    const { data: customers, error: custError } = await supabase.from('customers').insert(customersData).select()
    if (custError) return console.error('Error seeding customers:', custError)
    console.log(`Created ${customers.length} customers`)

    // 3. Create Rentals
    // Schema: rentals(id, user_id, client_id, item_id, start_date, end_date, status)
    const today = new Date()
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 7)

    const rentalsData = [
        // Active (In Use)
        {
            user_id: userId,
            client_id: customers[0].id,
            item_id: items[0].id,
            status: 'active',
            start_date: yesterday.toISOString(),
            end_date: tomorrow.toISOString()
        },
        // Reserved (Future)
        {
            user_id: userId,
            client_id: customers[1].id,
            item_id: items[1].id,
            status: 'active',
            start_date: nextWeek.toISOString(),
            end_date: nextWeek.toISOString()
        },
        // Completed/Late (Past) - using 'active' to simulate late return if logic matches
        {
            user_id: userId,
            client_id: customers[2].id,
            item_id: items[2].id,
            status: 'active',
            start_date: yesterday.toISOString(),
            end_date: yesterday.toISOString()
        }
    ]

    const { data: rentals, error: rentError } = await supabase.from('rentals').insert(rentalsData).select()
    if (rentError) return console.error('Error seeding rentals:', rentError)
    console.log(`Created ${rentals.length} rentals`)

    console.log('--- SEED COMPLETED ---')
}

seed()
