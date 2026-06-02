// Intake Confirmation Email
//
// Sent when a restaurant submission is received and queued for review.
// Contains: restaurant name, truncated submission ID, edit link, expected timeline.
//
// Governed by: track-02-verification-intelligence.md §3.5

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export type IntakeConfirmationEmailProps = {
  restaurantName: string
  /** Short reference shown to the submitter — e.g. first 8 chars of the submission UUID */
  submissionRef: string
  /** HMAC-signed edit link. Valid for 7 days while submission is in DRAFT. */
  editLink: string
}

export function IntakeConfirmationEmail({
  restaurantName,
  submissionRef,
  editLink,
}: IntakeConfirmationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your submission for {restaurantName} has been received.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Submission received</Heading>

          <Text style={text}>
            Thank you for submitting <strong>{restaurantName}</strong> to Chow Here.
            Our team will review your submission and get back to you within{' '}
            <strong>3–5 business days</strong>.
          </Text>

          <Section style={referenceBox}>
            <Text style={referenceLabel}>Reference number</Text>
            <Text style={referenceValue}>{submissionRef}</Text>
          </Section>

          <Text style={text}>
            Need to make changes before your submission enters review? You can edit
            your submission using the link below. This link is valid for{' '}
            <strong>7 days</strong> and becomes inactive once review begins.
          </Text>

          <Section style={buttonSection}>
            <Link href={editLink} style={button}>
              Edit submission
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            You are receiving this email because someone submitted {restaurantName}{' '}
            through the Chow Here restaurant submission form. If this was not you,
            you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default IntakeConfirmationEmail

// ─── Styles ──────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f9f9f9',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  margin: 0,
  padding: 0,
}

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  margin: '40px auto',
  padding: '40px',
  maxWidth: '560px',
  borderRadius: '8px',
  border: '1px solid #e5e5e5',
}

const h1: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 24px',
}

const text: React.CSSProperties = {
  color: '#444444',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const referenceBox: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  borderRadius: '6px',
  padding: '16px',
  margin: '0 0 24px',
}

const referenceLabel: React.CSSProperties = {
  color: '#71717a',
  fontSize: '12px',
  fontWeight: '600',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  margin: '0 0 4px',
}

const referenceValue: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '18px',
  fontWeight: '700',
  fontFamily: 'monospace',
  margin: 0,
}

const buttonSection: React.CSSProperties = {
  margin: '24px 0',
}

const button: React.CSSProperties = {
  backgroundColor: '#f97316',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
}

const hr: React.CSSProperties = {
  borderColor: '#e5e5e5',
  margin: '32px 0 24px',
}

const footer: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '20px',
  margin: 0,
}
