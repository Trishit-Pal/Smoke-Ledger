// MSG91 Flow API client — DLT-compliant SMS for the Indian market.
//
// Required prereqs (offline, multi-day; see docs/auth/msg91-setup.md):
//   1. TRAI DLT principal entity ID registered.
//   2. DLT template approved and registered in the MSG91 dashboard.
//   3. Sender ID provisioned (6 alphabetic chars, e.g. SMOKLR).
//
// The template MUST contain an OTP variable substitution (`##OTP##` or the
// equivalent MSG91 token defined when the template was registered). This client
// passes `otp` as the substitution value; map other vars if the template grew.

export interface SendOtpArgs {
  /** E.164 phone number with leading `+`, e.g. `+919876543210`. */
  phone: string;
  /** Numeric OTP delivered to the user. */
  otp: string;
  /** MSG91 auth key from Dashboard → API Keys. */
  authKey: string;
  /** Approved DLT template ID. */
  templateId: string;
  /** Sender ID (6 alphabetic chars). */
  senderId: string;
}

interface Msg91Recipient {
  mobiles: string;
  otp: string;
}

interface Msg91FlowRequest {
  template_id: string;
  sender: string;
  short_url: '0' | '1';
  recipients: Msg91Recipient[];
}

interface Msg91FlowResponse {
  type?: 'success' | 'error';
  message?: string;
  request_id?: string;
}

export async function sendOtpViaMsg91(args: SendOtpArgs): Promise<void> {
  if (!args.authKey || !args.templateId || !args.senderId) {
    throw new Error('msg91_misconfigured');
  }

  // MSG91 expects the mobile without the leading `+`.
  const mobile = args.phone.replace(/^\+/, '');

  const body: Msg91FlowRequest = {
    template_id: args.templateId,
    sender: args.senderId,
    short_url: '0',
    recipients: [
      {
        mobiles: mobile,
        otp: args.otp,
      },
    ],
  };

  const response = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      authkey: args.authKey,
    },
    body: JSON.stringify(body),
  });

  let parsed: Msg91FlowResponse | null = null;
  try {
    parsed = (await response.json()) as Msg91FlowResponse;
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed?.type === 'error') {
    const message = parsed?.message ?? response.statusText;
    throw new Error(`msg91_send_failed: ${message} (status ${response.status})`);
  }
}
