// Rejection Email
//
// Sent when an admin rejects a submission.
// Uses feedbackToSubmitter only — internalNotes are NEVER sent to submitters.
//
// Governed by: track-02-verification-intelligence.md §5.5, §7.6
// Security: track-02 §7.6 — internalNotes must never appear in external comms

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export type RejectionEmailProps = {
  restaurantName: string
  /**
   * Sanitised message for the submitter.
   * This is feedbackToSubmitter — NOT internalNotes.
   * The caller must never pass internalNotes here.
   */
  feedbackToSubmitter: string
}

export function RejectionEmail({ restaurantName, feedbackToSubmitter }: RejectionEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Update on your submission for {restaurantName}.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Submission not approved</Heading>

          <Text style={text}>
            Thank you for submitting <strong>{restaurantName}</strong> to Chow Here.
            After careful review, we are unable to approve this submission at this time.
          </Text>

          <Section style={feedbackBox}>
            <Text style={feedbackLabel}>Reason</Text>
            <Text style={feedbackText}>{feedbackToSubmitter}</Text>
          </Section>

          <Text style={text}>
            You are welcome to submit again in the future with updated information.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            You are receiving this email because {restaurantName} was submitted for
            review on Chow Here.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default RejectionEmail

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
  backgroundColor: '#fef2f2',
  borderLeft: '4px solid #ef4444',
  borderRadius: '0 6px 6px 0',
  padding: '16px 20px',
  margin: '0 0 24px',
}

const feedbackLabel: React.CSSProperties = {
  color: '#991b1b',
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
