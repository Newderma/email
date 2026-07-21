require('dotenv').config();
const express = require('express');
const path = require('path');
const supabase = require('./supabase');
const { sendAsEmployee } = require('./mailer');
const { buildReplyEmail } = require('./emailTemplates');
const { startScheduler, runCheckInCycle } = require('./scheduler');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const VALID_STATUSES = new Set(['done', 'in_progress', 'not_yet']);

// Fetch the approval + its tasks + employee name — what the approval page needs to render.
app.get('/api/approval/:token', async (req, res) => {
  const { token } = req.params;

  const { data: approval, error } = await supabase
    .from('hrf_approvals')
    .select('*, hrf_employees(name, email)')
    .eq('token', token)
    .single();

  if (error || !approval) {
    return res.status(404).json({ error: 'This link is invalid.' });
  }
  if (approval.status !== 'pending') {
    return res.status(410).json({ error: 'This link has already been used.' });
  }
  if (new Date(approval.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'This link has expired. Ask for a new check-in email.' });
  }

  const { data: tasks, error: taskErr } = await supabase
    .from('hrf_tasks')
    .select('id, task_text')
    .in('id', approval.task_ids);

  if (taskErr) {
    return res.status(500).json({ error: 'Could not load tasks.' });
  }

  res.json({
    employeeName: approval.hrf_employees.name,
    tasks,
  });
});

// Employee submits her real answers -> compose + send the reply as her, immediately.
app.post('/api/approval/:token/submit', async (req, res) => {
  const { token } = req.params;
  const { answers } = req.body; // [{ task_id, status, note }]

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'No answers provided.' });
  }
  for (const a of answers) {
    if (!VALID_STATUSES.has(a.status)) {
      return res.status(400).json({ error: `Invalid status: ${a.status}` });
    }
  }

  const { data: approval, error } = await supabase
    .from('hrf_approvals')
    .select('*, hrf_employees(id, name, email, smtp_key)')
    .eq('token', token)
    .single();

  if (error || !approval) return res.status(404).json({ error: 'This link is invalid.' });
  if (approval.status !== 'pending') return res.status(410).json({ error: 'Already submitted.' });
  if (new Date(approval.expires_at).getTime() < Date.now()) {
    return res.status(410).json({ error: 'This link has expired.' });
  }

  const { data: tasks, error: taskErr } = await supabase
    .from('hrf_tasks')
    .select('id, task_text')
    .in('id', approval.task_ids);
  if (taskErr) return res.status(500).json({ error: 'Could not load tasks.' });

  const taskById = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const enrichedAnswers = answers
    .filter((a) => taskById[a.task_id])
    .map((a) => ({
      task_text: taskById[a.task_id].task_text,
      status: a.status,
      note: (a.note || '').trim(),
    }));

  const employee = approval.hrf_employees;
  const { subject, text } = buildReplyEmail({
    employeeName: employee.name,
    managerName: process.env.MANAGER_NAME || 'Manager',
    answers: enrichedAnswers,
  });

  try {
    await sendAsEmployee({
      smtpKey: employee.smtp_key,
      fromName: employee.name,
      to: process.env.MANAGER_EMAIL,
      subject,
      text,
    });
  } catch (sendErr) {
    console.error('[server] Failed to send employee reply:', sendErr.message);
    return res.status(502).json({ error: 'Could not send the email. Try again shortly.' });
  }

  // Mark tasks done where she said done; mark approval submitted either way.
  const doneIds = answers.filter((a) => a.status === 'done').map((a) => a.task_id);
  if (doneIds.length > 0) {
    await supabase
      .from('hrf_tasks')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .in('id', doneIds);
  }
  await supabase
    .from('hrf_approvals')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('token', token);

  res.json({ ok: true });
});

app.get('/api/trigger-checkin', async (req, res) => {
  if (req.query.secret !== process.env.TRIGGER_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await runCheckInCycle();
  res.json({ ok: true, message: 'Check-in cycle ran.' });
});
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
  startScheduler();
});
