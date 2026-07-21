function buildCheckInEmail({ employeeName, tasks, approvalLink }) {
  const list = tasks.map((t) => `- ${t.task_text}`).join('\n');
  const managerName = process.env.MANAGER_NAME || 'الإدارة';

  const text =
    `مساء الخير ${employeeName}،\n\n` +
    `تحديث سريع على بعض المهام المفتوحة:\n\n${list}\n\n` +
    `الرجاء تحديث حالتك على هذه المهام من هنا:\n${approvalLink}\n\n` +
    `تحياتي،\n\n${managerName}`;

  const html =
    `<div dir="rtl" style="text-align:right;font-family:Calibri,Arial,sans-serif;color:#1e293b;">` +
    `<p>مساء الخير ${escapeHtml(employeeName)}،</p>` +
    `<p>تحديث سريع على بعض المهام المفتوحة:</p>` +
    `<ul>${tasks.map((t) => `<li>${escapeHtml(t.task_text)}</li>`).join('')}</ul>` +
    `<p>الرجاء <a href="${approvalLink}" style="color:inherit;text-decoration:none;font-weight:600;">تحديث حالتك</a> على هذه المهام.</p>` +
    `<p style="margin-top:20px;margin-bottom:2px;">تحياتي،</p>` +
    `<p style="margin-top:0;">${escapeHtml(managerName)}</p>` +
    `</div>`;

  return {
    subject: `تحديث سريع — ${tasks.length} ${tasks.length > 1 ? 'مهام مفتوحة' : 'مهمة مفتوحة'}`,
    text,
    html,
  };
}

function buildReplyEmail({ employeeName, managerName, answers }) {
  const statusLabel = { done: 'تم الإنجاز', in_progress: 'قيد التنفيذ', not_yet: 'لم يتم بعد' };
  const lines = answers.map((a) => {
    const base = `- ${a.task_text}: ${statusLabel[a.status] || a.status}`;
    return a.note ? `${base} (${a.note})` : base;
  });

  const text =
    `مرحباً ${managerName}،\n\n` +
    `إليك تحديثي:\n\n${lines.join('\n')}\n\n` +
    `مع تحياتي،\n${employeeName}`;

  return {
    subject: `رد: تحديث سريع للحالة`,
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