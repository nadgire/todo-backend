const sql = require('./connectDB');

// Fetch user by email
async function findUserByEmail(email) {
  const result = await sql`SELECT * FROM users WHERE email = ${email}`;
  return result[0];
}

// Create a new user
async function createUser(email, hashedPassword) {
  const result = await sql`
    INSERT INTO users (email, password)
    VALUES (${email}, ${hashedPassword})
    RETURNING *;
  `;
  return result[0];
}

// Update user password and account status
async function updatePassword(email, newHashedPassword, activate = false) {
  const result = await sql`
    UPDATE users
    SET password = ${newHashedPassword}, is_account_active = ${activate}
    WHERE email = ${email}
    RETURNING *;
  `;
  return result[0];
}

// Change account status
async function deactivateAccount(email) {
  await sql`UPDATE users SET is_account_active = FALSE WHERE email = ${email}`;
}

// Add task
async function addTask(email, newTask) {
  const result = await sql`
    UPDATE users
    SET tasks = tasks || ${JSON.stringify([newTask])}
    WHERE email = ${email}
    RETURNING tasks;
  `;
  return result[0].tasks;
}

// Get tasks
async function getTasks(email) {
  const result = await sql`
    SELECT tasks FROM users WHERE email = ${email}
  `;
  return result[0]?.tasks || [];
}

// Update task status
async function updateTask(email, taskId, field, value) {
  const user = await findUserByEmail(email);
  const tasks = user.tasks.map(task =>
    task.ID === taskId ? { ...task, [field]: value } : task
  );
  await sql`
    UPDATE users
    SET tasks = ${JSON.stringify(tasks)}
    WHERE email = ${email};
  `;
  return tasks;
}


module.exports = {
  findUserByEmail,
  createUser,
  updatePassword,
  deactivateAccount,
  addTask,
  getTasks,
  updateTask
};
