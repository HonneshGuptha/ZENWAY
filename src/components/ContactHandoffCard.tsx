import * as React from "react"
import { supabase } from "@/lib/supabase"
import { Phone, Mail, User, AlertCircle, Loader2, ShieldCheck } from "lucide-react"

export interface ContactHandoffCardProps {
  service: "rental" | "ride" | "carry"
  requestId: string
  fallbackName?: string | null
  className?: string
}

interface AcceptedContact {
  full_name: string
  phone: string | null
  email: string | null
}

export function ContactHandoffCard({
  service,
  requestId,
  fallbackName,
  className = "",
}: ContactHandoffCardProps) {
  const [contact, setContact] = React.useState<AcceptedContact | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [fetchFailed, setFetchFailed] = React.useState(false)

  React.useEffect(() => {
    let isMounted = true

    async function fetchContact() {
      if (!requestId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setFetchFailed(false)

        const { data, error } = await (supabase.rpc as any)("get_accepted_contact", {
          p_service: service,
          p_request_id: requestId,
        })

        if (!isMounted) return

        if (error) {
          console.warn("[ContactHandoffCard] RPC error:", error.message)
          setFetchFailed(true)
          return
        }

        if (data && Array.isArray(data) && data.length > 0) {
          setContact(data[0] as unknown as AcceptedContact)
        } else {
          setContact(null)
        }
      } catch (err: any) {
        console.error("[ContactHandoffCard] Fetch error:", err)
        if (isMounted) setFetchFailed(true)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchContact()

    return () => {
      isMounted = false
    }
  }, [service, requestId])

  if (isLoading) {
    return (
      <div className={`mt-3 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-center gap-2 text-xs text-muted-foreground ${className}`}>
        <Loader2 className="size-3.5 animate-spin text-emerald-600 dark:text-emerald-400" />
        <span>Loading verified contact details...</span>
      </div>
    )
  }

  // If request is not accepted or user is not authorized, don't show the card
  if (!contact && !fetchFailed) {
    return null
  }

  if (fetchFailed || !contact) {
    return null
  }

  // Parse phone number into clean 10-digit Indian mobile format
  const rawDigits = (contact.phone || "").replace(/\D/g, "")
  const tenDigitPhone =
    rawDigits.length === 12 && rawDigits.startsWith("91")
      ? rawDigits.slice(2)
      : rawDigits.length > 10
      ? rawDigits.slice(-10)
      : rawDigits

  const isValid10Digit = tenDigitPhone.length === 10
  const formattedPhone = isValid10Digit
    ? `+91 ${tenDigitPhone.slice(0, 5)} ${tenDigitPhone.slice(5)}`
    : contact.phone || null

  const serviceLabel =
    service === "rental"
      ? "vehicle rental"
      : service === "ride"
      ? "campus carpool ride"
      : "carry item delivery"

  const displayName = contact.full_name || fallbackName || "Campus Peer"
  const prefilledMessage = encodeURIComponent(
    `Hi ${displayName}! I'm connecting with you regarding our accepted ${serviceLabel} on ZENWAY.`
  )
  const whatsappUrl = isValid10Digit
    ? `https://wa.me/91${tenDigitPhone}?text=${prefilledMessage}`
    : null
  const callUrl = contact.phone ? `tel:${contact.phone.trim()}` : null

  return (
    <div
      className={`mt-3 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 text-foreground transition-all shadow-xs ${className}`}
    >
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-emerald-500/20">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>Verified Student Contact Handoff</span>
        </div>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium">
          Accepted
        </span>
      </div>

      <div className="pt-2 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <User className="size-3.5 text-muted-foreground" />
            <span>{displayName}</span>
          </div>

          {formattedPhone ? (
            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <Phone className="size-3 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-foreground">{formattedPhone}</span>
            </div>
          ) : (
            contact.email && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Mail className="size-3 text-muted-foreground" />
                <span>{contact.email}</span>
              </div>
            )
          )}
        </div>

        {/* Action Buttons */}
        {isValid10Digit && whatsappUrl ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            {/* Primary WhatsApp Button */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 h-10 min-h-[44px] sm:min-h-[38px] px-4 rounded-lg bg-[#25D366] hover:bg-[#20ba59] active:scale-[0.98] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer w-full sm:w-auto text-center"
            >
              <svg className="size-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.531 1.761.815 2.796.815 3.181 0 5.767-2.586 5.768-5.766 0-3.18-2.586-5.766-5.768-5.766zm9.969 5.766c0 5.518-4.482 10-10 10-1.745 0-3.376-.449-4.795-1.233l-5.205 1.365 1.391-5.077c-.886-1.488-1.391-3.23-1.391-5.055 0-5.518 4.482-10 10-10 5.518 0 10 4.482 10 10z"/>
              </svg>
              <span>Chat on WhatsApp</span>
            </a>

            {/* Secondary Call Button */}
            {callUrl && (
              <a
                href={callUrl}
                className="inline-flex items-center justify-center gap-1.5 h-10 min-h-[44px] sm:min-h-[38px] px-4 rounded-lg border border-border/80 bg-background hover:bg-muted active:scale-[0.98] text-foreground text-xs font-semibold shadow-xs transition-all cursor-pointer w-full sm:w-auto text-center"
              >
                <Phone className="size-3 text-muted-foreground shrink-0" />
                <span>Call</span>
              </a>
            )}
          </div>
        ) : (
          <div className="pt-1">
            <div className="p-2 rounded-lg bg-background/60 border border-border/50 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>Phone number not registered yet</span>
              </div>
              <p>
                This student has not linked their WhatsApp phone number yet. You can reach them via{" "}
                <span className="font-semibold text-foreground">{contact.email || "campus email"}</span>.
              </p>
              {contact.email && (
                <a
                  href={`mailto:${contact.email}?subject=${encodeURIComponent(`ZENWAY: ${serviceLabel} coordination`)}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold pt-0.5"
                >
                  <Mail className="size-3" />
                  <span>Send Email Now &rarr;</span>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
