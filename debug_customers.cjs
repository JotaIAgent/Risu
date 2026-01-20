
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://lrkbmpdnowciyfvvlotl.supabase.co'
const supabaseAnonKey = 'sb_publishable_Evk8NOdnzWSdEZCMAxinMA_zZAf7V9j'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkCustomers() {
    console.log('Fetching customers...')
    const { data, error } = await supabase
        .from('customers')
        .select('name, created_at, whatsapp')
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        console.error('Error:', error)
        return
    }

    console.log('Recent Customers:')
    if (data.length === 0) {
        console.log('No customers found.')
    }
    data.forEach(c => {
        console.log(`- ${c.name} (Criado em: ${c.created_at}, WhatsApp: ${c.whatsapp})`)
    })
}

checkCustomers()
