import React from "react"
import QRCode from "react-qr-code"
import { motion, AnimatePresence } from "motion/react"
import { AlertCircle, CheckCircle2, QrCode, X, Banknote, Wallet, ExternalLink, ShieldCheck } from "lucide-react"

export interface UPIPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  payeeUpi?: string | null
  payeeName?: string | null
  amount?: number | null
  txId?: string | null
}

export const UPIPaymentModal: React.FC<UPIPaymentModalProps> = ({
  isOpen,
  onClose,
  payeeUpi,
  payeeName = "Student Peer",
  amount,
  txId: _txId,
}) => {
  if (!isOpen) return null

  const numericAmount = amount == null ? 0 : Number(amount)
  const isZeroAmount = isNaN(numericAmount) || numericAmount <= 0
  const cleanUpi = payeeUpi ? payeeUpi.trim() : ""
  const isUpiMissing = !cleanUpi

  const upiString = `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent((payeeName || "ZENWAY").trim())}&am=${Number(numericAmount).toFixed(2)}&cu=INR`

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        {/* Backdrop click dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
        />

        {/* Modal Card with Spring Transition */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-sm rounded-3xl bg-card text-card-foreground border border-border/80 p-6 sm:p-7 shadow-2xl flex flex-col items-center text-center overflow-hidden"
        >
          {/* Subtle Ambient Radial Glow */}
          <div
            aria-hidden="true"
            className="absolute -top-20 -right-20 size-40 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"
          />

          {/* Top Close Icon Button */}
          <button
            onClick={onClose}
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-full hover:bg-muted/60 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" />
          </button>

          {/* 3D-styled Visual Header Container (3dicons.co / Refero inspiration) */}
          <div className="relative size-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/30 flex items-center justify-center shadow-md mb-3">
            <div className="size-9 rounded-xl bg-background/90 backdrop-blur-xs flex items-center justify-center shadow-xs">
              <Wallet className="size-5 text-emerald-600 dark:text-emerald-400 stroke-[2.2]" />
            </div>
          </div>

          {/* EDGE CASE 1: Zero Amount (Free Exchange) */}
          {isZeroAmount ? (
            <div className="w-full flex flex-col items-center my-2">
              <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground mb-1">₹0</h2>
              <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-4">
                Free Student Exchange
              </p>
              <div className="w-full p-4 rounded-2xl bg-muted/40 border border-border/60 text-xs text-muted-foreground text-center mb-5">
                This exchange is completely free. No payment required.
              </div>
            </div>
          ) : isUpiMissing ? (
            /* EDGE CASE 2: Missing UPI ID */
            <div className="w-full flex flex-col items-center my-2">
              <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <Banknote className="size-6" />
              </div>
              <h2 className="text-3xl font-extrabold text-foreground mb-1">₹{numericAmount}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Cash Settlement
              </p>
              <div className="w-full p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 text-center font-medium mb-5">
                UPI ID not linked on profile. Please settle this exchange in cash directly during meetup.
              </div>
            </div>
          ) : (
            /* STANDARD CASE: Valid Amount & Linked UPI -> Render QR + Breakdown */
            <div className="w-full flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 font-medium">
                <QrCode className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>UPI Settlement</span>
              </div>
              <h2 className="text-3xl font-extrabold text-foreground mb-0.5">
                ₹{numericAmount}
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                Scan with GPay, PhonePe, or Paytm
              </p>

              {/* QR Code Container (White frame for reliable camera scans) */}
              <div className="p-3 bg-white rounded-2xl border border-border/70 shadow-md mb-2 flex items-center justify-center">
                <QRCode key={upiString} value={upiString} size={190} />
              </div>

              {/* Mobile Deep Link Shortcut */}
              <a
                href={upiString}
                className="inline-flex sm:hidden items-center justify-center gap-1.5 text-xs text-primary font-semibold py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/15 transition-colors mb-2"
              >
                <span>Open in Installed UPI App</span>
                <ExternalLink className="size-3" />
              </a>

              {/* Refero-style transparent fee breakdown */}
              <div className="w-full p-3 rounded-2xl bg-muted/40 border border-border/60 text-xs space-y-1.5 text-left mb-3">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Payee Peer:</span>
                  <span className="font-semibold text-foreground truncate max-w-[160px]">{payeeName}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>UPI VPA:</span>
                  <span className="font-mono text-[11px] text-foreground truncate max-w-[170px]">{payeeUpi}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/40">
                  <span>Platform Fee:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹0 (Zero Cuts)</span>
                </div>
              </div>

              {/* Safety notice */}
              <div className="w-full p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                    Verify settlement directly with your peer upon pickup or handoff.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* UI Verse Inspired High-Contrast Primary Done Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            type="button"
            className="w-full py-3 px-4 bg-primary hover:bg-primary/95 text-primary-foreground text-sm font-semibold rounded-2xl shadow-md hover:shadow-lg transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring flex items-center justify-center gap-1.5"
          >
            <ShieldCheck className="size-4" />
            <span>Done</span>
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}

export default UPIPaymentModal
