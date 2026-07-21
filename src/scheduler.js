const cron = require('node-cron');
const crypto = require('crypto');
const supabase = require('./supabase');
const { sendAsManager } = require('./mailer');
const { buildCheckInEmail } = require('./emailTemplates');

const INTERVAL_DAYS = Number(process.env.FOLLOWUP_INTERVAL_DAYS || 4);
const EXPIRY_HOURS = Number(process.env.APPROVAL_LINK_EXPIRY_HOURS || 72);

function isDue(lastContactedAt) {
  if (!lastContactedAt) return true;
  const last = new Date(lastContactedAt).getTime();
  const dueAt = last + INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() >= dueAt;
}

async function runCheckInCycle() {
  console.log(`[scheduler] Running check-in cycle at ${new Date().toISOString()}`);

  const { data: employees, error: empErr } = await supabase
    .from('hrf_employees')
    .select('*')
    .eq('active', true);

  if (empErr) {
    console.error('[scheduler] Failed to load employees:', empErr.message);
    return;
  }

  for (const employee of employees) {
    if (!isDue(employee.last_contacted_at)) continue;

    const { data: tasks, error: taskErr } = await supabase
      .from('hrf_tasks')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'open');

    if (taskErr) {
      console.error(`[scheduler] Failed to load tasks for ${employee.name}:`, taskErr.message);
      continue;
    }
    if (!tasks || tasks.length === 0) continue; // nothing open, skip her this cycle

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

    const { error: approvalErr } = await supabase.from('hrf_approvals').insert({
      employee_id: employee.id,
      token,
      task_ids: tasks.map((t) => t.id),
      status: 'pending',
      expires_at: expiresAt,
    });

    if (approvalErr) {
      console.error(`[scheduler] Failed to create approval for ${employee.name}:`, approvalErr.message);
      continue;
    }

    const approvalLink = `${process.env.APPROVAL_BASE_URL}/approve.html?token=${token}`;
    const { subject, text, html } = buildCheckInEmail({
      employeeName: employee.name,
      tasks,
      approvalLink,
    });

    try {
      await sendAsManager({ to: employee.email, subject, text, html });
      await supabase
        .from('hrf_employees')
        .update({ last_contacted_at: new Date().toISOString() })
        .eq('id', employee.id);
      console.log(`[scheduler] Sent check-in to ${employee.name} (${tasks.length} tasks)`);
    } catch (sendErr) {
      console.error(`[scheduler] Failed to send email to ${employee.name}:`, sendErr.message);
    }
  }
}

function startScheduler() {
  // Runs once a day; the isDue() check inside handles the actual 4-5 day cadence
  // per employee, so this can safely run daily without over-emailing anyone.
  cron.schedule('0 8 * * *', runCheckInCycle); // 08:00 server time daily
  console.log('[scheduler] Daily check-in job scheduled for 08:00');
}

if (require.main === module && process.argv.includes('--run-once')) {
  runCheckInCycle().then(() => process.exit(0));
}

module.exports = { startScheduler, runCheckInCycle };
