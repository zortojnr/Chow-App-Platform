// Needs-Info Email
//
// Sent when an admin transitions a submission to NEEDS_INFO.
// Contains: admin feedback text, response URL (token embedded), deadline.
//
// Security: never includes internalNotes, admin identity, or raw token.
// Governed by: track-02-verification-intelligence.md §4.4, §5.4, §7.6

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

export type NeedsInfoEmailProps = {
  restaurantName: string
  /** Admin-authored message to the submitter. Never contains internalNotes. */
  feedbackToSubmitter: string
  /** Full response URL: APP_URL/verify/respond?token=... */
  responseUrl: string
  /** Human-readable deadline, e.g. "15 July 2026" */
  deadlineDate: string
}

export function NeedsInfoEmail({
  restaurantName,
  feedbackToSubmitter,
  responseUrl,
  deadlineDate,
}: NeedsInfoEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Action required: we need more information about {restaurantName}.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>More information needed</Heading>

          <Text style={text}>
            Thank you for submitting <strong>{restaurantName}</strong> to Chow Here.
            Our review team has a question before we can continue with your submission.
          </Text>

          <Section style={feedbackBox}>
            <Text style={feedbackLabel}>Message from our review team</Text>
            <Text style={feedbackText}>{feedbackToSubmitter}</Text>
          </Section>

          <Text style={text}>
            Please respond using the link below. Your response will return your
            submission to the review queue. This link expires on{' '}
            <strong>{deadlineDate}</strong>.
          </Text>

          <Section style={buttonSection}>
            <Link href={responseUrl} style={button}>
              Respond to review team
            </Link>
          </Section>

          <Text style={warningText}>
            Do not share this link. It is unique to your submission and can only
            be used once.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            You are receiving this email because {restaurantName} was submitted for
            review on Chow Here. If you did not submit this restaurant, you can
            ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default NeedsInfoEmail

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

const feedbackBox: React.CSSProperties = {
  backgroundColor: '#fef9f0',
  borderLeft: '4px solid #f97316',
  borderRadius: '0 6px 6px 0',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const feedbackLabel: React.CSSProperties = {
  color: '#92400e',
  fontSize: '11px',
  fontWeight: '700',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  margin: '0 0 8px',
}

const feedbackText: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '15px',
  lineHeight: '24px',
  margin: 0,
  whiteSpace: 'pre-wrap',
}

const buttonSection: React.CSSProperties = {
  margin: '24px 0 16px',
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

const warningText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 16px',
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
