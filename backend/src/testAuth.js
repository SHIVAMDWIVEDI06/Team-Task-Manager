async function testAuth() {
  const uniqueString = Date.now().toString();
  const username = `user_${uniqueString}`;
  const email = `${username}@example.com`;
  const password = 'securepassword123';

  console.log('--- Testing Signup ---');
  try {
    const signupRes = await fetch('http://localhost:5000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const signupData = await signupRes.json();
    console.log('Status:', signupRes.status);
    console.log('Response:', signupData);
    
    if (signupRes.status !== 201 || !signupData.token) {
      throw new Error('Signup failed');
    }
  } catch (err) {
    console.error('Signup error:', err);
  }

  console.log('\n--- Testing Login ---');
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    console.log('Status:', loginRes.status);
    console.log('Response:', loginData);
    
    if (loginRes.status !== 200 || !loginData.token) {
      throw new Error('Login failed');
    }
  } catch (err) {
    console.error('Login error:', err);
  }
}

testAuth();
