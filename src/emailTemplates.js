/**
 * Turns a list of open task rows into the manager's check-in email.
 * Deliberately plain language — the task_text the user wrote is trusted
 * as-is, no attempt to parse or restructure it.
 */
function buildCheckInEmail({ employeeName, tasks, approvalLink }) {
  const list = tasks.map((t) => `- ${t.task_text}`).join('\n');
  const text =
    `Hi ${employeeName},\n\n` +
    `Quick check-in on a few open items:\n\n${list}\n\n` +
    `Please give a quick status update here (takes under a minute):\n${approvalLink}\n\n` +
    `Thanks,\n${process.env.MANAGER_NAME || 'Manager'}`;

  const html =
    `<p>Hi ${escapeHtml(employeeName)},</p>` +
    `<p>Quick check-in on a few open items:</p>` +
    `<ul>${tasks.map((t) => `<li>${escapeHtml(t.task_text)}</li>`).join('')}</ul>` +
    `<p><a href="${approvalLink}">Click here to give a quick status update</a> (takes under a minute).</p>` +
    `<p>Thanks,<br/>${escapeHtml(process.env.MANAGER_NAME || 'Manager')}</p>`;

  return {
    subject: `Quick status check — ${tasks.length} open item${tasks.length > 1 ? 's' : ''}`,
    text,
    html,
  };
}

/**
 * Composes the employee's reply email FROM HER ACTUAL SUBMITTED ANSWERS.
 * Nothing here is guessed — statuses/notes come directly from what she
 * tapped/typed on the approval page.
 */
function buildReplyEmail({ employeeName, managerName, answers }) {
  // answers: [{ task_text, status: 'done'|'in_progress'|'not_yet', note }]
  const statusLabel = { done: 'Done', in_progress: 'In progress', not_yet: 'Not yet' };
  const lines = answers.map((a) => {
    const base = `- ${a.task_text}: ${statusLabel[a.status] || a.status}`;
    return a.note ? `${base} (${a.note})` : base;
  });

  const text =
    `Hi ${managerName},\n\n` +
    `Here's my update:\n\n${lines.join('\n')}\n\n` +
    `Best,\n${employeeName}`;

  return {
    subject: `Re: Quick status check`,
    text,
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { buildCheckInEmail, buildReplyEmail };
