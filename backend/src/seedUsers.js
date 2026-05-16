require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function seedUsers() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // First, delete all users with dash-prefixed usernames
    await client.query("DELETE FROM users WHERE username LIKE 'dash-%'");
    console.log('✅ Removed all dash-prefixed users');

    // Hash password for all users (using 'password123' as default)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Create new users with proper names
    const users = [
      { username: 'pawan', email: 'pawan@test.com', role: 'Admin' },
      { username: 'madhwan', email: 'madhwan@test.com', role: 'Admin' },
      { username: 'shreya', email: 'shreya@test.com', role: 'Member' },
      { username: 'kirti', email: 'kirti@test.com', role: 'Member' },
      { username: 'kritika', email: 'kritika@test.com', role: 'Member' },
      { username: 'saksham', email: 'saksham@test.com', role: 'Member' },
      { username: 'sejal', email: 'sejal@test.com', role: 'Member' },
      { username: 'gursimar', email: 'gursimar@test.com', role: 'Member' },
      { username: 'yash', email: 'yash@test.com', role: 'Member' },
      { username: 'admin', email: 'admin@test.com', role: 'Admin' }
    ];

    for (const user of users) {
      try {
        // Check if user already exists
        const existingUser = await client.query(
          'SELECT id FROM users WHERE email = $1 OR username = $2',
          [user.email, user.username]
        );

        if (existingUser.rows.length > 0) {
          // Update existing user
          await client.query(
            'UPDATE users SET username = $1, email = $2, password = $3, role = $4 WHERE id = $5',
            [user.username, user.email, hashedPassword, user.role, existingUser.rows[0].id]
          );
          console.log(`✅ Updated user: ${user.username}`);
        } else {
          // Insert new user
          await client.query(
            'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
            [user.username, user.email, hashedPassword, user.role]
          );
          console.log(`✅ Created user: ${user.username}`);
        }
      } catch (err) {
        console.error(`❌ Error processing user ${user.username}:`, err.message);
      }
    }

    console.log('\n🎉 User seeding completed!');
    console.log('\nTest Credentials:');
    console.log('==================');
    console.log('Admin users:');
    console.log('  - admin@test.com / password123');
    console.log('  - pawan@test.com / password123');
    console.log('  - madhwan@test.com / password123');
    console.log('\nMember users:');
    console.log('  - shreya@test.com / password123');
    console.log('  - kirti@test.com / password123');
    console.log('  - kritika@test.com / password123');
    console.log('  - saksham@test.com / password123');
    console.log('  - sejal@test.com / password123');
    console.log('  - gursimar@test.com / password123');
    console.log('  - yash@test.com / password123');

  } catch (err) {
    console.error('❌ Error seeding users:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seedUsers();
