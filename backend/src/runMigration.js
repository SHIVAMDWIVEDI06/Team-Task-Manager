require('dotenv').config();

async function runMigration() {
  const migrationName = process.argv[2];
  
  if (!migrationName) {
    console.error('Please provide a migration name');
    console.log('Usage: node src/runMigration.js <migration-name>');
    process.exit(1);
  }

  try {
    const migration = require(`./migrations/${migrationName}`);
    
    console.log(`Running migration: ${migrationName}`);
    await migration.up();
    console.log(`Migration ${migrationName} completed successfully`);
    
    process.exit(0);
  } catch (error) {
    console.error(`Error running migration ${migrationName}:`, error);
    process.exit(1);
  }
}

runMigration();
