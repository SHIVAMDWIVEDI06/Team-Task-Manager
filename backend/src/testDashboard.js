const BASE = 'http://localhost:5000/api';
const ts = Date.now();

async function testDashboard() {
  let adminToken, memberToken, adminId, memberId, projectId;

  console.log('--- Setting up test data ---');
  
  // 1. Signup Admin
  const signupAdmin = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `dash_admin_${ts}`, email: `dash_admin_${ts}@test.com`, password: 'password123' })
  });
  const adminData = await signupAdmin.json();
  adminToken = adminData.token;
  adminId = adminData.user.id;

  // 2. Signup Member
  const signupMember = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `dash_member_${ts}`, email: `dash_member_${ts}@test.com`, password: 'password123' })
  });
  const memberData = await signupMember.json();
  memberToken = memberData.token;
  memberId = memberData.user.id;

  // 3. Create Project
  const createProj = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ name: 'Dashboard Project', description: 'Testing dashboard' })
  });
  const projData = await createProj.json();
  projectId = projData.project.id;

  // 4. Add Member
  await fetch(`${BASE}/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ userId: memberId })
  });

  // 5. Create Tasks
  const tasks = [
    { title: 'In Progress Task 1', status: 'In Progress', priority: 'Medium', assigned_user_id: memberId, due_date: '2026-12-31' },
    { title: 'In Progress Task 2', status: 'In Progress', priority: 'Medium', assigned_user_id: memberId, due_date: '2026-12-31' },
    { title: 'Overdue High Task', status: 'To Do', priority: 'High', assigned_user_id: memberId, due_date: '2020-01-01' },
    { title: 'Done Task', status: 'Done', priority: 'Low', assigned_user_id: memberId, due_date: '2026-12-31' }
  ];

  for (const task of tasks) {
    await fetch(`${BASE}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ ...task, project_id: projectId })
    });
  }

  console.log('--- Testing Dashboard Endpoint ---');
  
  const response = await fetch(`${BASE}/dashboard/${projectId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const dashboardData = await response.json();

  console.log('Status:', response.status);
  console.log('Response:', JSON.stringify(dashboardData, null, 2));

  if (response.status === 200 && dashboardData.workloadAnalysis.length > 0) {
    console.log('Dashboard Test PASSED');
  } else {
    console.log('Dashboard Test FAILED');
  }
}

testDashboard().catch(console.error);
