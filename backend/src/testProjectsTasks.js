const BASE = 'http://localhost:5000/api';
const ts = Date.now();

async function test() {
  let adminToken, memberToken, adminId, memberId, projectId, taskId;

  // === 1. Register Admin user ===
  console.log('\n=== 1. Register Admin User ===');
  const signupAdmin = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `admin_${ts}`, email: `admin_${ts}@test.com`, password: 'pass123' })
  });
  const adminData = await signupAdmin.json();
  console.log('Status:', signupAdmin.status, '| User:', adminData.user?.username);
  adminToken = adminData.token;
  adminId = adminData.user.id;

  // === 2. Register Member user ===
  console.log('\n=== 2. Register Member User ===');
  const signupMember = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `member_${ts}`, email: `member_${ts}@test.com`, password: 'pass123' })
  });
  const memberData = await signupMember.json();
  console.log('Status:', signupMember.status, '| User:', memberData.user?.username);
  memberToken = memberData.token;
  memberId = memberData.user.id;

  // === 3. Admin creates a project ===
  console.log('\n=== 3. Admin Creates Project ===');
  const createProj = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ name: `TestProject_${ts}`, description: 'A test project' })
  });
  const projData = await createProj.json();
  console.log('Status:', createProj.status, '| Project:', projData.project?.name);
  projectId = projData.project.id;

  // === 4. Admin adds member to project ===
  console.log('\n=== 4. Admin Adds Member to Project ===');
  const addMember = await fetch(`${BASE}/projects/${projectId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ userId: memberId })
  });
  const addMemberData = await addMember.json();
  console.log('Status:', addMember.status, '|', addMemberData.message);

  // === 5. Admin creates a task assigned to member ===
  console.log('\n=== 5. Admin Assigns Task to Member ===');
  const createTask = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      title: 'Fix the login bug',
      description: 'The login page crashes on empty password',
      due_date: '2026-06-01',
      priority: 'High',
      assigned_user_id: memberId,
      project_id: projectId
    })
  });
  const taskData = await createTask.json();
  console.log('Status:', createTask.status, '| Task:', taskData.task?.title, '| Assigned to:', taskData.task?.assigned_user_id);
  taskId = taskData.task.id;

  // === 6. Member fetches their tasks ===
  console.log('\n=== 6. Member Fetches "My Tasks" ===');
  const myTasks = await fetch(`${BASE}/tasks/my-tasks`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const myTasksData = await myTasks.json();
  console.log('Status:', myTasks.status, '| Tasks found:', myTasksData.length);
  if (myTasksData.length > 0) {
    console.log('First task:', myTasksData[0].title, '| Status:', myTasksData[0].status);
  }

  // === 7. Member updates task status ===
  console.log('\n=== 7. Member Updates Task Status ===');
  const updateTask = await fetch(`${BASE}/tasks/${taskId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberToken}` },
    body: JSON.stringify({ status: 'In Progress' })
  });
  const updateData = await updateTask.json();
  console.log('Status:', updateTask.status, '| New status:', updateData.task?.status);

  // === 8. Member tries to CREATE a task (should be 403) ===
  console.log('\n=== 8. Member Tries to Create Task (should be 403) ===');
  const memberCreateTask = await fetch(`${BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${memberToken}` },
    body: JSON.stringify({
      title: 'Unauthorized task',
      project_id: projectId,
      assigned_user_id: memberId
    })
  });
  const memberCreateData = await memberCreateTask.json();
  console.log('Status:', memberCreateTask.status, '| Error:', memberCreateData.error);

  console.log('\n=== ALL TESTS COMPLETE ===');
}

test().catch(console.error);
