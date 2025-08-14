import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Clear old content and re-run ingestion
async function refreshContent() {
  console.log('🔄 Starting content refresh...')
  
  try {
    // Get count of existing documents
    const { count: beforeCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Current documents in database: ${beforeCount}`)
    
    // Clear documents older than 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .lt('last_crawled_at', thirtyDaysAgo.toISOString())
    
    if (deleteError) {
      console.error('Error deleting old documents:', deleteError)
    } else {
      console.log(`🗑️  Cleared documents older than 30 days`)
    }
    
    // Get count after cleanup
    const { count: afterCleanupCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Documents after cleanup: ${afterCleanupCount}`)
    
    // Re-run the ingestion process
    console.log('🚀 Starting fresh ingestion...')
    
    // Import and run the main ingest function
    const { main } = await import('./ingest')
    await main()
    
    // Get final count
    const { count: finalCount } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Final document count: ${finalCount}`)
    console.log(`✅ Content refresh completed successfully!`)
    
  } catch (error) {
    console.error('❌ Content refresh failed:', error)
    process.exit(1)
  }
}

// Allow this script to be run directly or imported
if (require.main === module) {
  refreshContent().catch(console.error)
}

export { refreshContent }