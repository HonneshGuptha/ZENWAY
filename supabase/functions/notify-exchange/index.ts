import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, any>;
  old_record?: Record<string, any> | null;
  [key: string]: any;
}

interface NotificationEmailTemplate {
  subject: string;
  heading: string;
  subheading: string;
  body: string;
}

const serviceTemplates = {
  rental_requests: {
    name: "Rental",
    accent: "#059669",
    accentDark: "#047857",
    insert: {
      subject: "New Rental Request on ZENWAY",
      heading: "A new rental request needs your review.",
      subheading: "Someone has requested to rent your vehicle.",
      body: "Review the renter's details and requested dates, then confirm or decline the request in your ZENWAY dashboard.",
    },
    accepted: {
      subject: "Your ZENWAY Rental Request Was Accepted!",
      heading: "Your rental request was accepted!",
      subheading: "Your vehicle booking is confirmed.",
      body: "Review the rental details and coordinate the pickup with the vehicle owner through your ZENWAY dashboard.",
    },
  },
  ride_requests: {
    name: "Carpool",
    accent: "#2563eb",
    accentDark: "#1d4ed8",
    insert: {
      subject: "New Carpool Seat Request on ZENWAY",
      heading: "A passenger is requesting a carpool seat.",
      subheading: "A new seat request is waiting for your review.",
      body: "Check the passenger's details and trip information, then confirm or decline the seat request in your ZENWAY dashboard.",
    },
    accepted: {
      subject: "Your ZENWAY Carpool Request Was Accepted!",
      heading: "Your carpool seat request was accepted!",
      subheading: "Your place in the carpool is confirmed.",
      body: "Review the trip details and coordinate with the driver through your ZENWAY dashboard.",
    },
  },
  carry_requests: {
    name: "Carry Items",
    accent: "#d97706",
    accentDark: "#b45309",
    insert: {
      subject: "New Carry Item Request on ZENWAY",
      heading: "Your carry item request is now posted.",
      subheading: "Campus carriers can now review your item and delivery details.",
      body: "Check your ZENWAY dashboard for offers from campus carriers and choose the offer that works best for you.",
    },
    accepted: {
      subject: "Your ZENWAY Carry Item Request Was Accepted!",
      heading: "A carrier has accepted your carry item request!",
      subheading: "Your delivery request has been matched with a carrier.",
      body: "Review the pickup and delivery details, then coordinate with your assigned carrier through your ZENWAY dashboard.",
    },
  },
} as const;

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase Admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
      return new Response(
        JSON.stringify({ error: "Missing Supabase configuration in Edge Function environment." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 2. Parse incoming Webhook payload
    const body: WebhookPayload = await req.json();
    console.log("Received notify-exchange payload:", JSON.stringify(body));

    const eventType = body.type ?? "INSERT";
    const tableName = body.table ?? body.table_name;
    const record = body.record ?? body.new ?? body;
    const oldRecord = body.old_record ?? body.old;

    // Filter tables: only handle supported exchange requests
    if (
      !tableName ||
      (tableName !== "rental_requests" && tableName !== "ride_requests" && tableName !== "carry_requests")
    ) {
      return new Response(
        JSON.stringify({
          message: `Ignored table '${tableName}'. Supported tables: 'rental_requests', 'ride_requests', 'carry_requests'.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceTemplate =
      tableName === "rental_requests"
        ? serviceTemplates.rental_requests
        : tableName === "ride_requests"
          ? serviceTemplates.ride_requests
          : serviceTemplates.carry_requests;

    // 3. Determine recipient and notification context based on eventType
    let recipientId: string | undefined = undefined;
    let emailTemplate: NotificationEmailTemplate;

    if (eventType === "INSERT") {
      // Notify the listing owner, driver, or carry requester for a new request.
      emailTemplate = serviceTemplate.insert;

      if (tableName === "rental_requests") {
        recipientId = record.owner_id;
      } else if (tableName === "ride_requests") {
        recipientId = record.driver_id;

        // If driver_id is not directly in the request record, look it up from the rides table
        if (!recipientId && record.ride_id) {
          const { data: rideData, error: rideError } = await supabase
            .from("rides")
            .select("driver_id")
            .eq("id", record.ride_id)
            .maybeSingle();

          if (rideError) {
            console.error("Error looking up ride for request:", rideError);
          } else if (rideData?.driver_id) {
            recipientId = rideData.driver_id;
          }
        }
      } else if (tableName === "carry_requests") {
        recipientId = record.requester_id;
      }
    } else if (eventType === "UPDATE") {
      // Status update: Check if request was accepted
      const currentStatus = record.status;
      const previousStatus = oldRecord?.status;

      if (currentStatus !== "accepted" || previousStatus === "accepted") {
        return new Response(
          JSON.stringify({
            message: `Ignored UPDATE from status '${previousStatus}' to '${currentStatus}'. Only transitions to 'accepted' trigger notification.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Notify the requester that their request was accepted.
      emailTemplate = serviceTemplate.accepted;

      if (tableName === "rental_requests") {
        recipientId = record.renter_id;
      } else if (tableName === "ride_requests") {
        recipientId = record.passenger_id;
      } else if (tableName === "carry_requests") {
        recipientId = record.requester_id;
      }
    } else {
      return new Response(
        JSON.stringify({ message: `Ignored unhandled event type '${eventType}'.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recipientId) {
      console.error(`Could not resolve recipient ID for ${eventType} on ${tableName}:`, record);
      return new Response(
        JSON.stringify({ error: `Could not resolve recipient ID for ${tableName} ${eventType} event.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Query profiles table to retrieve recipient full name and email
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", recipientId)
      .maybeSingle();

    if (profileError) {
      console.warn("Notice: Query to profiles encountered error:", profileError.message);
    }

    let recipientName = profile?.full_name?.trim() || "Campus Peer";
    let recipientEmail = profile?.email?.trim();

    // Secondary fallback: query auth.users if profiles.email is not populated
    if (!recipientEmail) {
      const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(recipientId);
      if (!authUserError && authUserData?.user?.email) {
        recipientEmail = authUserData.user.email;
      }
    }

    if (!recipientEmail) {
      console.error(`Unable to find email address for recipient ID ${recipientId} (${eventType} on ${tableName})`);
      return new Response(
        JSON.stringify({ error: `Recipient email could not be located for profile ${recipientId}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[notify-exchange] Preparing ${eventType} notification email for ${recipientEmail} (${recipientName}) on ${tableName}`);

    // 5. Verify Brevo API Key
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      console.error("Missing BREVO_API_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "Missing BREVO_API_KEY environment variable." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL") || "notifications@zenway.in";
    const appUrl = Deno.env.get("APP_URL") || "https://zenway.in";
    const emailSubject = emailTemplate.subject;

    // 6. Build Professional HTML Email
    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0f172a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);">
          <!-- Header Banner -->
          <tr>
            <td style="padding: 32px 32px 24px; background: linear-gradient(135deg, ${serviceTemplate.accent} 0%, ${serviceTemplate.accentDark} 100%); text-align: left;">
              <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #a7f3d0;">ZENWAY ${serviceTemplate.name}</span>
              <h1 style="margin: 8px 0 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">ZENWAY</h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px; text-align: left;">
              <p style="margin: 0 0 16px; font-size: 16px; line-height: 24px; color: #94a3b8;">
                Hi <strong style="color: #f8fafc;">${recipientName}</strong>,
              </p>

              <div style="background-color: #0f172a; border-left: 4px solid ${serviceTemplate.accent}; border-radius: 6px; padding: 18px 20px; margin: 24px 0;">
                <p style="margin: 0; font-size: 17px; font-weight: 600; line-height: 26px; color: #f1f5f9;">
                  ${emailTemplate.heading}
                </p>
                <p style="margin: 8px 0 0; font-size: 14px; line-height: 20px; color: #94a3b8;">
                  ${emailTemplate.subheading}
                </p>
              </div>

              <p style="margin: 0 0 28px; font-size: 15px; line-height: 24px; color: #cbd5e1;">
                ${emailTemplate.body}
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 32px 0 16px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: ${serviceTemplate.accent};">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.01em;">
                      Log In to ZENWAY Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 28px 0 0; font-size: 13px; line-height: 20px; color: #64748b;">
                Safe, verified peer-to-peer campus transit. Maintain communication exclusively via authenticated campus channels.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #172033; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 18px;">
                Sent securely by ZENWAY Campus Mobility System.<br>
                This automated notification was delivered to <span style="color: #94a3b8;">${recipientEmail}</span>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // 7. Dispatch Transactional Email via Brevo API
    const brevoPayload = {
      sender: {
        name: "ZENWAY Campus",
        email: brevoSenderEmail,
      },
      to: [
        {
          email: recipientEmail,
          name: recipientName,
        },
      ],
      subject: emailSubject,
      htmlContent: emailHtml,
    };

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": brevoApiKey,
      },
      body: JSON.stringify(brevoPayload),
    });

    const brevoResponseBody = await brevoResponse.json().catch(() => ({}));

    if (!brevoResponse.ok) {
      console.error(
        `[Brevo Error] Status: ${brevoResponse.status} - Failed to dispatch email for ${eventType} on ${tableName} to ${recipientEmail}:`,
        brevoResponseBody
      );
      return new Response(
        JSON.stringify({
          error: "Failed to dispatch email via Brevo API",
          status: brevoResponse.status,
          details: brevoResponseBody,
        }),
        { status: brevoResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `[Brevo Success] Dispatched ${eventType} notification to ${recipientEmail} (${recipientName}) for ${tableName}. Message ID: ${brevoResponseBody.messageId}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Campus notification dispatched successfully via Brevo.",
        message_id: brevoResponseBody.messageId,
        recipient: recipientEmail,
        event: eventType,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unhandled error in notify-exchange function:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", message: err?.message || String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
