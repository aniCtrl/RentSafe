import { StellarService } from '../services/stellar';

async function runIntegrationTest() {
  console.log('🚀 Starting RentSafe Integration Test Suite...');
  
  // Use testnet configuration
  const service = new StellarService('testnet');
  const config = service.getConfig();
  
  console.log(`📌 Loaded Escrow contract: ${config.escrow}`);
  console.log(`📌 Loaded Dispute contract: ${config.dispute}`);
  console.log(`📌 Loaded Token SAC: ${config.token}`);
  console.log(`📌 Connected to RPC endpoint: ${config.rpcUrl}`);
  
  try {
    console.log('\n🔍 Querying active agreement count from Escrow contract...');
    const count = await service.getAgreementCount();
    console.log(`✅ Success! Total registered agreements on Testnet: ${count}`);
    
    console.log('\n🔍 Querying active dispute count from Dispute contract...');
    const disputeCount = await service.getDisputeCount();
    console.log(`✅ Success! Total registered disputes on Testnet: ${disputeCount}`);
    
    if (count > 0) {
      console.log('\n🔍 Querying details for agreement #1...');
      const agreement = await service.getAgreement(1);
      console.log('✅ Success! Agreement details:');
      console.log(`  - Tenant: ${agreement.tenant}`);
      console.log(`  - Landlord: ${agreement.landlord}`);
      console.log(`  - Amount: ${agreement.amount} XLM`);
      console.log(`  - State: ${agreement.state}`);
    } else {
      console.log('\nℹ️ No active agreements found on-chain to fetch.');
    }
    
    console.log('\n🎉 Integration Test completed successfully! All read operations verified.');
  } catch (err) {
    console.error('\n❌ Integration Test failed:', err);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module || !module.parent) {
  runIntegrationTest();
}
