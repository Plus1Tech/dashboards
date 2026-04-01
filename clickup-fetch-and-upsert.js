const SUPABASE_URL = 'https://pdsvsxzjbkcvychbzqit.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY';
const CLICKUP_KEY  = 'YOUR_NEW_CLICKUP_API_KEY';

const TARGET_LISTS = [
  'general tasks', 'project tasks', 'ai project tasks', 'project roadmap'
];
const MAX_PAGES = 20;

let page = 0;
let totalUpserted = 0;

while (page < MAX_PAGES) {
  const response = await this.helpers.httpRequest({
    method: 'GET',
    url: 'https://api.clickup.com/api/v2/team/9017426462/task',
    headers: { 'Authorization': CLICKUP_KEY },
    qs: {
      page,
      'space_ids[]': '90172135105',
      subtasks: false,
      include_closed: false
    }
  });

  const tasks = response.tasks || [];
  if (tasks.length === 0) break;

  const taskRows = [];
  const assigneeRows = [];

  for (const task of tasks) {
    const listName = (task.list?.name || '').toLowerCase().trim();
    if (!TARGET_LISTS.includes(listName)) continue;

    let priority = null;
    if (task.priority) {
      priority = typeof task.priority === 'object'
        ? (task.priority.priority || '').toLowerCase()
        : task.priority.toLowerCase();
    }

    taskRows.push({
      id: task.id,
      name: task.name,
      status: task.status?.status || task.status || 'unknown',
      priority,
      list_name: task.list?.name || null,
      updated_at: new Date().toISOString()
    });

    for (const a of (task.assignees || [])) {
      assigneeRows.push({
        task_id: task.id,
        member_id: a.id,
        member_name: a.username || String(a.id)
      });
    }
  }

  if (taskRows.length > 0) {
    await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://pdsvsxzjbkcvychbzqit.supabase.co/rest/v1/clickup_tasks',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: taskRows,
      json: true
    });
  }

  if (assigneeRows.length > 0) {
    await this.helpers.httpRequest({
      method: 'POST',
      url: 'https://pdsvsxzjbkcvychbzqit.supabase.co/rest/v1/clickup_task_assignees',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: assigneeRows,
      json: true
    });
  }

  totalUpserted += taskRows.length;
  if (tasks.length < 100) break;
  page++;
}

return [{ json: { totalUpserted } }];
