import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-utils'

const BREVO_API_KEY = process.env.BREVO_API_KEY || ''
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

export async function POST(request: Request) {
  try {
    // Only allow admins to test
    const user = await requireAuth()
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (!BREVO_API_KEY) {
      return NextResponse.json({ 
        success: false, 
        error: 'BREVO_API_KEY not configured' 
      }, { status: 400 })
    }

    const body = await request.json()
    const toEmail = body.email

    if (!toEmail) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email address required' 
      }, { status: 400 })
    }

    console.log('Testing Brevo email to:', toEmail)

    const emailPayload = {
      sender: {
        name: 'Scrumbies',
        email: process.env.EMAIL_FROM || 'scrumbies@hesab.com',
      },
      to: [
        {
          email: toEmail,
          name: toEmail.split('@')[0],
        },
      ],
      subject: 'Scrumbies Test Email',
      textContent: 'This is a test email from Scrumbies to verify email delivery is working.',
      htmlContent: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #2563eb;">🎯 Scrumbies Test Email</h1>
          <p>This is a test email to verify that email delivery is working correctly.</p>
          <p>If you received this email, the Brevo integration is working!</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #6b7280; font-size: 14px;">
            Sent at: ${new Date().toISOString()}<br>
            Sent to: ${toEmail}
          </p>
        </div>
      `,
    }

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    const responseText = await response.text()
    console.log('Brevo response status:', response.status)

    let result
    try {
      result = JSON.parse(responseText)
    } catch {
      result = { raw: responseText }
    }

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Brevo API error',
        status: response.status,
        details: result,
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${toEmail}`,
      messageId: result.messageId,
    })

  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST with {"email": "your@email.com"} to send a test email',
  })
}
