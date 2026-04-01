const TARGET_LISTS = [
  'general tasks',
  'project tasks',
  'ai project tasks',
  'project roadmap'
];

const TEAM = [
  { id: 89298060,  name: 'Brian Cerny' },
  { id: 95215340,  name: 'Scott Taney' },
  { id: 95214039,  name: 'Mike Ciano' },
  { id: 95214035,  name: 'John Mccloskey' },
  { id: 95214031,  name: 'Alex Gordon' },
  { id: 95214025,  name: 'Nate Herr' },
  { id: 95213820,  name: 'Charlotte Herring' },
  { id: 111933449, name: 'Marc Umstead' },
  { id: 95171147,  name: 'Jessica Peaden' }
];

// Cap how many task objects we store per member to avoid OOM on large datasets.
// Counts (urgent/high/normal/low/taskCount) are still accurate for all tasks.
const MAX_TASKS_PER_MEMBER = 50;
const MAX_UNASSIGNED = 30;

const tasks = $input.first().json.tasks || [];
const byMember = {};
const unassigned = [];

TEAM.forEach(m => {
  byMember[m.id] = { memberId: m.id, name: m.name, urgent: 0, high: 0, normal: 0, low: 0, taskCount: 0, tasks: [] };
});

for (const task of tasks) {
  const listName = (task.list?.name || '').toLowerCase().trim();
  if (!TARGET_LISTS.includes(listName)) continue;

  let priority = null;
  if (task.priority) {
    if (typeof task.priority === 'object') priority = (task.priority.priority || '').toLowerCase();
    else priority = task.priority.toLowerCase();
  }

  // Only store assignee IDs in the clean object — avoids duplicating full user
  // objects once per member entry when a task has multiple assignees.
  const assigneeIds = (task.assignees || []).map(a => a.id);
  const assigneeNames = (task.assignees || []).map(a => ({ id: a.id, name: a.username || String(a.id) }));

  const clean = {
    id: task.id,
    name: task.name,
    status: task.status?.status || task.status || 'unknown',
    priority,
    assignees: assigneeNames,
    list: task.list?.name || null
  };

  if (!assigneeIds.length) {
    if (unassigned.length < MAX_UNASSIGNED) unassigned.push(clean);
  } else {
    assigneeIds.forEach((id, i) => {
      const member = byMember[id];
      if (!member) return;

      member.taskCount++;
      const p = priority || 'low';
      if (member[p] !== undefined) member[p]++;
      else member.low++;

      // Only keep a bounded list of task objects; counts above are always accurate.
      if (member.tasks.length < MAX_TASKS_PER_MEMBER) {
        member.tasks.push(clean);
      }
    });
  }
}

return [{
  json: {
    success: true,
    timestamp: new Date().toISOString(),
    totalTasks: Object.values(byMember).reduce((s, m) => s + m.taskCount, 0) + unassigned.length,
    unassignedCount: unassigned.length,
    unassigned,
    members: Object.values(byMember)
  }
}];
