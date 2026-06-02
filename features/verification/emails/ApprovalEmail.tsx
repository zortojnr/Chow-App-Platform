// Approval Email
//
// Sent when an admin approves a submission (PENDING_REVIEW → APPROVED).
// Governed by: track-02-verification-intelligence.md §5.3

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'

export type ApprovalEmailProps = {
  restaurantName: string
}

export function ApprovalEmail({ restaurantName }: ApprovalEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{restaurantName} has been approved on Chow Here.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={h1}>Your submission has been approved</Heading>

          <Text style={text}>
            Great news — <strong>{restaurantName}</strong> has been reviewed and
            approved by our team. It is now live on Chow Here and discoverable
            by users searching for dishes in your area.
          </Text>

          <Text style={text}>
            Thank you for contributing to Chow Here and helping us build a trusted
            guide to Nigerian food.
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

export default ApprovalEmail

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
