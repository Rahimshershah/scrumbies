// Brevo Email Service
// Documentation: https://developers.brevo.com/docs/getting-started

const BREVO_API_KEY = process.env.BREVO_API_KEY || ''
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'
const FROM_EMAIL = process.env.EMAIL_FROM || 'noreply@scrumbies.hesab.com'
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Scrumbies'

interface SendEmailOptions {
  to: string
  subject: string
  text: string
  html?: string
  toName?: string
}

// Brand colors and styles
const brandStyles = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  secondary: '#64748b',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  background: '#f8fafc',
  cardBg: '#ffffff',
  text: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
}

// Email wrapper template - fully table-based for email client compatibility
function emailWrapper(content: string): string {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://scrumbies.hesab.com'
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scrumbies</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${brandStyles.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.background};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; width: 100%;">
          <!-- Header -->
          <tr>
            <td align="left" style="padding-bottom: 24px;">
              <img src="https://em-content.zobj.net/source/apple/391/direct-hit_1f3af.png" alt="🎯" width="24" height="24" style="vertical-align: middle; margin-right: 8px;" />
              <span style="font-size: 24px; font-weight: 700; color: ${brandStyles.text}; vertical-align: middle;">Scrumbies</span>
            </td>
          </tr>
          <!-- Main Content Card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.cardBg}; border-radius: 12px;">
                <tr>
                  <td style="padding: 32px;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 24px;">
              <p style="margin: 0; font-size: 13px; color: ${brandStyles.textMuted};">
                This email was sent by Scrumbies. 
                <a href="${baseUrl}" style="color: ${brandStyles.primary}; text-decoration: none;">Open Scrumbies</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// Helper to create avatar placeholder - table-based for email compatibility
function avatarPlaceholder(name: string, size: number = 40): string {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-radius: 50%; background: linear-gradient(135deg, ${brandStyles.primary}, #7c3aed); width: ${size}px; height: ${size}px; min-width: ${size}px; min-height: ${size}px; table-layout: fixed;">
      <tr>
        <td width="${size}" height="${size}" align="center" valign="middle" style="border-radius: 50%; color: white; font-weight: 600; font-size: ${Math.floor(size * 0.4)}px; min-width: ${size}px; min-height: ${size}px; line-height: ${size}px;">
          ${initials}
        </td>
      </tr>
    </table>
  `
}

// Status badge - inline-block safe for emails
function statusBadge(status: string): string {
  const statusColors: Record<string, { bg: string; text: string }> = {
    'TODO': { bg: '#e2e8f0', text: '#475569' },
    'IN_PROGRESS': { bg: '#dbeafe', text: '#1d4ed8' },
    'READY_TO_TEST': { bg: '#fef3c7', text: '#d97706' },
    'BLOCKED': { bg: '#fee2e2', text: '#dc2626' },
    'DONE': { bg: '#dcfce7', text: '#16a34a' },
    'LIVE': { bg: '#f3e8ff', text: '#9333ea' },
  }
  const colors = statusColors[status] || statusColors['TODO']
  const label = status.replace(/_/g, ' ')
  return `<span style="display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background-color: ${colors.bg}; color: ${colors.text};">${label}</span>`
}

// Priority badge
function priorityBadge(priority: string): string {
  const priorityConfig: Record<string, { icon: string; color: string }> = {
    'LOW': { icon: '↓', color: '#64748b' },
    'MEDIUM': { icon: '→', color: '#2563eb' },
    'HIGH': { icon: '↑', color: '#f59e0b' },
    'URGENT': { icon: '!!', color: '#dc2626' },
  }
  const config = priorityConfig[priority] || priorityConfig['MEDIUM']
  return `<span style="color: ${config.color}; font-weight: 600;">${config.icon} ${priority}</span>`
}

// Button component - table-based for bulletproof email rendering
function emailButton(text: string, url: string, variant: 'primary' | 'secondary' = 'primary'): string {
  const bgColor = variant === 'primary' ? brandStyles.primary : brandStyles.cardBg
  const textColor = variant === 'primary' ? '#ffffff' : brandStyles.text
  const borderStyle = variant === 'secondary' ? `border: 1px solid ${brandStyles.border};` : ''
  
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="background-color: ${bgColor}; border-radius: 8px; ${borderStyle}">
          <a href="${url}" style="display: inline-block; padding: 12px 24px; color: ${textColor}; text-decoration: none; font-weight: 600; font-size: 14px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `
}

// Send email using Brevo API
export async function sendEmail({ to, subject, text, html, toName }: SendEmailOptions) {
  if (!BREVO_API_KEY) {
    console.warn('Brevo API key not configured, skipping email send')
    return
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: FROM_NAME,
          email: FROM_EMAIL,
        },
        to: [
          {
            email: to,
            name: toName || to.split('@')[0],
          },
        ],
        subject,
        textContent: text,
        htmlContent: html || text,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Brevo API error:', error)
      throw new Error(`Failed to send email: ${error.message || response.statusText}`)
    }

    const result = await response.json()
    console.log('Email sent successfully via Brevo:', result.messageId)
    return result
  } catch (error) {
    console.error('Failed to send email via Brevo:', error)
  }
}

// ============================================
// TASK ASSIGNMENT NOTIFICATION
// ============================================
export interface TaskAssignmentData {
  recipientEmail: string
  recipientName: string
  assignerName: string
  taskKey: string
  taskTitle: string
  taskDescription?: string
  taskPriority?: string
  taskStatus?: string
  sprintName?: string
  dueDate?: string
  taskUrl: string
}

export async function sendTaskAssignmentEmail(data: TaskAssignmentData) {
  const { recipientEmail, recipientName, assignerName, taskKey, taskTitle, taskDescription, taskPriority, taskStatus, sprintName, dueDate, taskUrl } = data

  const content = `
    <!-- Header -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-bottom: 24px; border-bottom: 1px solid ${brandStyles.border};">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: ${brandStyles.textMuted};">New task assigned to you</p>
          <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: ${brandStyles.text};">
            <span style="color: ${brandStyles.textMuted}; font-weight: 500;">${taskKey}</span> ${taskTitle}
          </h1>
        </td>
      </tr>
    </table>

    <!-- Assigner info -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 20px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="middle" style="padding-right: 12px;">
                ${avatarPlaceholder(assignerName, 36)}
              </td>
              <td valign="middle">
                <p style="margin: 0; font-size: 14px; color: ${brandStyles.text};">
                  <strong>${assignerName}</strong> assigned this task to you
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Task details -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.background}; border-radius: 8px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            ${taskStatus ? `
            <tr>
              <td style="padding: 6px 0; width: 100px; color: ${brandStyles.textMuted}; font-size: 13px;">Status</td>
              <td style="padding: 6px 0;">${statusBadge(taskStatus)}</td>
            </tr>
            ` : ''}
            ${taskPriority ? `
            <tr>
              <td style="padding: 6px 0; width: 100px; color: ${brandStyles.textMuted}; font-size: 13px;">Priority</td>
              <td style="padding: 6px 0;">${priorityBadge(taskPriority)}</td>
            </tr>
            ` : ''}
            ${sprintName ? `
            <tr>
              <td style="padding: 6px 0; width: 100px; color: ${brandStyles.textMuted}; font-size: 13px;">Sprint</td>
              <td style="padding: 6px 0; font-size: 14px; color: ${brandStyles.text};">${sprintName}</td>
            </tr>
            ` : ''}
            ${dueDate ? `
            <tr>
              <td style="padding: 6px 0; width: 100px; color: ${brandStyles.textMuted}; font-size: 13px;">Due Date</td>
              <td style="padding: 6px 0; font-size: 14px; color: ${brandStyles.text};">${dueDate}</td>
            </tr>
            ` : ''}
          </table>
        </td>
      </tr>
    </table>

    ${taskDescription ? `
    <!-- Description -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 20px 0 0 0;">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: ${brandStyles.textMuted}; font-weight: 600;">DESCRIPTION</p>
          <p style="margin: 0; font-size: 14px; color: ${brandStyles.text}; line-height: 1.6;">${taskDescription.replace(/<[^>]*>/g, '').slice(0, 300)}${taskDescription.length > 300 ? '...' : ''}</p>
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- CTA -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-top: 28px;">
          ${emailButton('View Task', taskUrl)}
        </td>
      </tr>
    </table>
  `

  await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    subject: `[${taskKey}] ${assignerName} assigned you: ${taskTitle}`,
    text: `${assignerName} assigned you to "${taskTitle}".\n\nView task: ${taskUrl}`,
    html: emailWrapper(content),
  })
}

// ============================================
// COMMENT NOTIFICATION
// ============================================
export interface CommentNotificationData {
  recipientEmail: string
  recipientName: string
  commenterName: string
  commenterAvatar?: string
  taskKey: string
  taskTitle: string
  commentContent: string
  taskUrl: string
  isReply?: boolean
}

export async function sendCommentNotificationEmail(data: CommentNotificationData) {
  const { recipientEmail, recipientName, commenterName, taskKey, taskTitle, commentContent, taskUrl } = data

  const cleanComment = commentContent.replace(/<[^>]*>/g, '').slice(0, 500)

  const content = `
    <!-- Header -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-bottom: 20px;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: ${brandStyles.textMuted};">New comment on</p>
          <h1 style="margin: 0; font-size: 18px; font-weight: 600; color: ${brandStyles.text};">
            <span style="color: ${brandStyles.textMuted}; font-weight: 500;">${taskKey}</span> ${taskTitle}
          </h1>
        </td>
      </tr>
    </table>

    <!-- Comment -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.background}; border-radius: 8px; border-left: 4px solid ${brandStyles.primary};">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="top" style="padding-right: 12px;">
                ${avatarPlaceholder(commenterName, 32)}
              </td>
              <td valign="top">
                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${brandStyles.text};">${commenterName}</p>
                <p style="margin: 0; font-size: 14px; color: ${brandStyles.text}; line-height: 1.6;">${cleanComment}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-top: 24px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding-right: 12px;">
                ${emailButton('View Comment', taskUrl)}
              </td>
              <td>
                ${emailButton('Reply', taskUrl, 'secondary')}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `

  await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    subject: `[${taskKey}] ${commenterName} commented: ${taskTitle}`,
    text: `${commenterName} commented on "${taskTitle}":\n\n"${cleanComment}"\n\nView: ${taskUrl}`,
    html: emailWrapper(content),
  })
}

// ============================================
// MENTION NOTIFICATION
// ============================================
export async function sendMentionNotification(
  recipientEmail: string,
  recipientName: string,
  mentionerName: string,
  taskTitle: string,
  commentContent: string,
  taskUrl: string,
  taskKey?: string
) {
  const cleanComment = commentContent.replace(/<[^>]*>/g, '').slice(0, 500)
  const displayKey = taskKey || 'TASK'

  const content = `
    <!-- Header with @ icon -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-bottom: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="middle" style="padding-right: 12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.primary}; border-radius: 50%;">
                  <tr>
                    <td width="40" height="40" align="center" valign="middle" style="color: white; font-size: 20px; font-weight: bold;">
                      @
                    </td>
                  </tr>
                </table>
              </td>
              <td valign="middle">
                <p style="margin: 0 0 4px 0; font-size: 14px; color: ${brandStyles.textMuted};">You were mentioned</p>
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: ${brandStyles.text};">
                  ${mentionerName} mentioned you in a comment
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Task reference -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-bottom: 16px;">
          <p style="margin: 0; font-size: 14px; color: ${brandStyles.text};">
            On <strong><span style="color: ${brandStyles.textMuted};">${displayKey}</span> ${taskTitle}</strong>
          </p>
        </td>
      </tr>
    </table>

    <!-- Comment highlight -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #eff6ff; border-radius: 8px;">
      <tr>
        <td style="padding: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="top" style="padding-right: 12px;">
                ${avatarPlaceholder(mentionerName, 36)}
              </td>
              <td valign="top">
                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: ${brandStyles.text};">${mentionerName}</p>
                <p style="margin: 0; font-size: 14px; color: ${brandStyles.text}; line-height: 1.6;">${cleanComment}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-top: 24px;">
          ${emailButton('View & Reply', taskUrl)}
        </td>
      </tr>
    </table>
  `

  await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    subject: `${mentionerName} mentioned you in ${displayKey}`,
    text: `${mentionerName} mentioned you in a comment on "${taskTitle}":\n\n"${cleanComment}"\n\nView: ${taskUrl}`,
    html: emailWrapper(content),
  })
}

// ============================================
// USER INVITE EMAIL
// ============================================
export async function sendInviteEmail(
  recipientEmail: string,
  inviterName: string,
  inviteUrl: string,
  projectNames: string[]
) {
  const content = `
    <!-- Header -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-bottom: 24px;">
          <img src="https://em-content.zobj.net/source/apple/391/party-popper_1f389.png" alt="🎉" width="48" height="48" style="display: block; margin: 0 auto 16px auto;" />
          <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: ${brandStyles.text};">
            You're invited!
          </h1>
          <p style="margin: 0; font-size: 16px; color: ${brandStyles.textMuted};">
            ${inviterName} wants you to join the team
          </p>
        </td>
      </tr>
    </table>

    <!-- Projects -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.background}; border-radius: 8px;">
      <tr>
        <td style="padding: 20px;">
          <p style="margin: 0 0 12px 0; font-size: 13px; color: ${brandStyles.textMuted}; font-weight: 600; text-transform: uppercase;">You'll have access to</p>
          ${projectNames.map(name => `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding: 8px 0;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td width="42" valign="middle">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.primary}; border-radius: 6px;">
                          <tr>
                            <td width="32" height="32" align="center" valign="middle" style="color: white; font-size: 14px; font-weight: 700;">
                              ${name.slice(0, 2).toUpperCase()}
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td valign="middle">
                        <span style="font-size: 15px; font-weight: 500; color: ${brandStyles.text};">${name}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          `).join('')}
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-top: 28px;">
          ${emailButton('Accept Invitation', inviteUrl)}
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 16px;">
          <p style="margin: 0; font-size: 13px; color: ${brandStyles.textMuted};">
            This invitation expires in 7 days
          </p>
        </td>
      </tr>
    </table>
  `

  await sendEmail({
    to: recipientEmail,
    subject: `${inviterName} invited you to Scrumbies`,
    text: `${inviterName} has invited you to join Scrumbies and collaborate on ${projectNames.join(', ')}.\n\nAccept invitation: ${inviteUrl}\n\nThis invitation expires in 7 days.`,
    html: emailWrapper(content),
  })
}

// ============================================
// WEEKLY DIGEST EMAIL
// ============================================
export interface WeeklyDigestTask {
  key: string
  title: string
  status: string
  completedAt?: string
  assignee?: string
  url: string
}

export interface WeeklyDigestData {
  recipientEmail: string
  recipientName: string
  projectName: string
  weekStart: string
  weekEnd: string
  completedTasks: WeeklyDigestTask[]
  inProgressTasks: WeeklyDigestTask[]
  totalCompleted: number
  totalInProgress: number
  sprintName?: string
  dashboardUrl: string
}

export async function sendWeeklyDigestEmail(data: WeeklyDigestData) {
  const { recipientEmail, recipientName, projectName, weekStart, weekEnd, completedTasks, inProgressTasks, totalCompleted, totalInProgress, sprintName, dashboardUrl } = data

  const taskRow = (task: WeeklyDigestTask, showStatus: boolean = false) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid ${brandStyles.border};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="width: 70px; vertical-align: top;">
              <span style="font-size: 12px; color: ${brandStyles.textMuted}; font-family: monospace;">${task.key}</span>
            </td>
            <td style="vertical-align: top;">
              <a href="${task.url}" style="font-size: 14px; color: ${brandStyles.text}; text-decoration: none; font-weight: 500;">${task.title}</a>
              ${showStatus ? `<br><span style="font-size: 12px;">${statusBadge(task.status)}</span>` : ''}
              ${task.assignee ? `<br><span style="font-size: 12px; color: ${brandStyles.textMuted};">Assigned to ${task.assignee}</span>` : ''}
            </td>
            <td style="width: 24px; vertical-align: top; text-align: right;">
              <span style="color: ${brandStyles.success};">✓</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `

  const content = `
    <!-- Header -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-bottom: 24px; border-bottom: 1px solid ${brandStyles.border};">
          <p style="margin: 0 0 4px 0; font-size: 14px; color: ${brandStyles.textMuted};">Weekly Summary</p>
          <h1 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: ${brandStyles.text};">
            ${projectName}
          </h1>
          <p style="margin: 0; font-size: 14px; color: ${brandStyles.textMuted};">
            ${weekStart} – ${weekEnd}${sprintName ? ` • ${sprintName}` : ''}
          </p>
        </td>
      </tr>
    </table>

    <!-- Stats -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 24px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="48%" align="center" style="padding: 16px; background-color: #dcfce7; border-radius: 8px;">
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: ${brandStyles.success};">${totalCompleted}</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #166534; font-weight: 500;">Completed</p>
              </td>
              <td width="4%"></td>
              <td width="48%" align="center" style="padding: 16px; background-color: #dbeafe; border-radius: 8px;">
                <p style="margin: 0; font-size: 32px; font-weight: 700; color: ${brandStyles.primary};">${totalInProgress}</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #1e40af; font-weight: 500;">In Progress</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${completedTasks.length > 0 ? `
    <!-- Completed Tasks -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-bottom: 16px;">
          <p style="margin: 0 0 12px 0; font-size: 13px; color: ${brandStyles.textMuted}; font-weight: 600;">✅ COMPLETED THIS WEEK</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.background}; border-radius: 8px; padding: 4px 12px;">
            ${completedTasks.slice(0, 10).map(task => taskRow(task)).join('')}
          </table>
          ${completedTasks.length > 10 ? `
            <p style="margin: 12px 0 0 0; font-size: 13px; color: ${brandStyles.textMuted};">
              + ${completedTasks.length - 10} more tasks completed
            </p>
          ` : ''}
        </td>
      </tr>
    </table>
    ` : ''}

    ${inProgressTasks.length > 0 ? `
    <!-- In Progress -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-top: 8px;">
          <p style="margin: 0 0 12px 0; font-size: 13px; color: ${brandStyles.textMuted}; font-weight: 600;">🚀 CURRENTLY IN PROGRESS</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.background}; border-radius: 8px; padding: 4px 12px;">
            ${inProgressTasks.slice(0, 5).map(task => taskRow(task, true)).join('')}
          </table>
        </td>
      </tr>
    </table>
    ` : ''}

    <!-- CTA -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding-top: 28px;">
          ${emailButton('View Dashboard', dashboardUrl)}
        </td>
      </tr>
    </table>
  `

  await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    subject: `📊 Weekly Summary: ${totalCompleted} tasks completed in ${projectName}`,
    text: `Weekly Summary for ${projectName}\n${weekStart} – ${weekEnd}\n\nCompleted: ${totalCompleted} tasks\nIn Progress: ${totalInProgress} tasks\n\nView dashboard: ${dashboardUrl}`,
    html: emailWrapper(content),
  })
}

// ============================================
// DOCUMENT COMMENT EMAIL (Confluence-style)
// ============================================
export interface DocumentCommentData {
  recipientEmail: string
  recipientName: string
  commenterName: string
  documentTitle: string
  folderName: string
  commentContent: string
  documentUrl: string
  projectName: string
}

export async function sendDocumentCommentEmail(data: DocumentCommentData) {
  const { recipientEmail, recipientName, commenterName, documentTitle, folderName, commentContent, documentUrl, projectName } = data

  const cleanComment = commentContent.replace(/<[^>]*>/g, '').slice(0, 500)

  const content = `
    <!-- Header -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-bottom: 20px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="middle" style="padding-right: 12px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color: #f0f9ff; border-radius: 8px;">
                  <tr>
                    <td width="40" height="40" align="center" valign="middle" style="font-size: 20px;">
                      📄
                    </td>
                  </tr>
                </table>
              </td>
              <td valign="middle">
                <p style="margin: 0 0 4px 0; font-size: 12px; color: ${brandStyles.textMuted};">${projectName} / ${folderName}</p>
                <p style="margin: 0; font-size: 16px; font-weight: 600; color: ${brandStyles.text};">
                  ${documentTitle}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Comment -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${brandStyles.background}; border-radius: 8px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td valign="top" style="padding-right: 12px;">
                ${avatarPlaceholder(commenterName, 32)}
              </td>
              <td valign="top">
                <p style="margin: 0 0 4px 0; font-size: 13px; color: ${brandStyles.textMuted};">
                  <strong style="color: ${brandStyles.text};">${commenterName}</strong> commented
                </p>
                <p style="margin: 0; font-size: 14px; color: ${brandStyles.text}; line-height: 1.6;">${cleanComment}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding-top: 24px;">
          ${emailButton('View Document', documentUrl)}
        </td>
      </tr>
    </table>
  `

  await sendEmail({
    to: recipientEmail,
    toName: recipientName,
    subject: `💬 ${commenterName} commented on "${documentTitle}"`,
    text: `${commenterName} commented on "${documentTitle}" in ${folderName}:\n\n"${cleanComment}"\n\nView: ${documentUrl}`,
    html: emailWrapper(content),
  })
}

// Legacy function for backwards compatibility
export async function sendAssignmentNotification(
  recipientEmail: string,
  recipientName: string,
  assignerName: string,
  taskTitle: string,
  taskUrl: string
) {
  await sendTaskAssignmentEmail({
    recipientEmail,
    recipientName,
    assignerName,
    taskKey: 'TASK',
    taskTitle,
    taskUrl,
  })
}
