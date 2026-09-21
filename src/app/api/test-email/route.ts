import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'
import { getEmailProvider, sendEmailStrict } from '@/lib/email'

export async function POST(request: Request) {
  try {
    // Only allow admins to test
    const user = await requireAuth()
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const provider = getEmailProvider()
    if (provider === 'none') {
      return NextResponse.json({
        success: false,
        error: 'No email provider configured. Set RESEND_API_KEY (preferred) or BREVO_API_KEY.',
      }, { status: 400 })
    }

    const body = await request.json()
    const toEmail = body.email

    if (!toEmail) {
      return NextResponse.json({
        success: false,
        error: 'Email address required',
      }, { status: 400 })
    }

    console.log(`Testing ${provider} email to:`, toEmail)

    const sentAt = new Date().toISOString()
    const result = await sendEmailStrict({
      to: toEmail,
      subject: 'Scrumbies Test Email',
      text: 'This is a test email from Scrumbies to verify email delivery is working.',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">🎯 Scrumbies Test Email</h1>
          <p>This is a test email to verify that email delivery is working correctly.</p>
          <p>If you received this email, the ${provider} integration is working!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            Provider: ${provider}<br>
            Sent at: ${sentAt}<br>
            Sent to: ${toEmail}
          </p>
        </div>
      `,
    })

    return NextResponse.json({
      success: true,
      provider: result.provider,
      message: `Test email sent to ${toEmail} via ${result.provider}`,
      messageId: result.messageId,
    })

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({
      success: false,
      provider: getEmailProvider(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    provider: getEmailProvider(),
    from: process.env.EMAIL_FROM || 'scrumbies@hesab.com',
    message: 'Use POST with {"email": "your@email.com"} to send a test email',
  })
}
