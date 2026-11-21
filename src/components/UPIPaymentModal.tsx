import React from "react"
import QRCode from "react-qr-code"
import { AlertCircle, CheckCircle2, QrCode, X, Banknote } from "lucide-react"

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in-0 duration-150">
      <div className="relative w-full max-w-sm rounded-2xl bg-card text-card-foreground border border-border/80 p-6 shadow-2xl flex flex-col items-center text-center">
        {/* Top Close Icon Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg cursor-pointer"
        >
          <X className="size-4" />
        </button>

        {/* EDGE CASE 1: Zero Amount (Free Exchange) */}
        {isZeroAmount ? (
          <div className="w-full flex flex-col items-center my-4">
            <div className="size-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <CheckCircle2 className="size-6" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">₹0</h2>
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-4">
              Free Exchange
            </p>
            <div className="w-full p-4 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground text-center mb-6">
              This exchange is free. No payment required.
            </div>
          </div>
        ) : isUpiMissing ? (
          /* EDGE CASE 2: Missing UPI ID */
          <div className="w-full flex flex-col items-center my-4">
            <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
              <Banknote className="size-6" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-1">₹{numericAmount}</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Cash Settlement
            </p>
            <div className="w-full p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 text-center font-medium mb-6">
              UPI ID not linked. Please settle this transaction in cash.
            </div>
          </div>
        ) : (
          /* STANDARD CASE: Valid Amount & Linked UPI -> Render QR */
          <div className="w-full flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 font-medium">
              <QrCode className="size-3.5 text-primary" />
              <span>UPI Settlement</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-0.5">
              ₹{numericAmount}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Scan with any UPI app
            </p>

            {/* QR Code Container (Always white background for scannability) */}
            <div className="p-3.5 bg-white rounded-2xl border border-border/60 shadow-xs mb-1 flex items-center justify-center">
              <QRCode key={upiString} value={upiString} size={220} />
            </div>

            <p className="text-xs text-center mt-4 font-mono text-muted-foreground">
              Target: {payeeUpi}
            </p>

            {/* Informational Alert on manual receiver verification */}
            <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left mb-5">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium leading-relaxed">
                  Note: ZENWAY does not track transactions. Please verify the payment success directly on the receiver's phone.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Primary Action Button: "Done" directing back to booking card */}
        <button
          onClick={onClose}
          type="button"
          className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          Done
        </button>
      </div>
    </div>
  )
}

export default UPIPaymentModal
