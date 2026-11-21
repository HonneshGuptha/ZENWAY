import * as React from "react"
import { ZenwayMascot } from "@/components/ui/ZenwayMascot"
import { ZenwayLogo } from "@/components/brand/ZenwayLogo"
import { Button } from "@/components/ui/button"
import { RefreshCw, Home, AlertTriangle, RotateCcw } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ZENWAY ErrorBoundary] Uncaught runtime exception:", error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = (): void => {
    window.location.reload()
  }

  handleReturnHome = (): void => {
    window.location.href = "/"
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const errorMessage = this.state.error?.message || "An unexpected client application error occurred."

      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 sm:p-6 font-sans selection:bg-primary/20">
          <div className="w-full max-w-md mx-auto text-center space-y-6">
            {/* Header Brand */}
            <div className="flex justify-center">
              <ZenwayLogo size="md" withBadge={false} />
            </div>

            {/* Error Recovery Card */}
            <div className="border border-border/80 rounded-2xl bg-card p-6 sm:p-8 shadow-xl space-y-5 text-center">
              <div className="flex justify-center">
                <ZenwayMascot pose="idle" size="md" />
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-destructive/20 bg-destructive/10 text-destructive text-xs font-semibold">
                <AlertTriangle className="size-3.5" />
                <span>Interface Recovery</span>
              </div>

              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Something went wrong on campus
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  An unexpected client-side error occurred while rendering this view. Your session, bookings, and student account data remain completely safe.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                <Button
                  onClick={this.handleReset}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Try Again</span>
                </Button>
                <Button
                  onClick={this.handleReload}
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                >
                  <RefreshCw className="size-3.5" />
                  <span>Reload Platform</span>
                </Button>
                <Button
                  onClick={this.handleReturnHome}
                  size="sm"
                  className="w-full sm:w-auto text-xs font-semibold gap-1.5 cursor-pointer shadow-xs"
                >
                  <Home className="size-3.5" />
                  <span>Return Home</span>
                </Button>
              </div>

              {/* Developer Technical Details (Non-prod or collapsible) */}
              <details className="text-left text-[11px] font-mono text-muted-foreground bg-muted/40 rounded-lg p-2.5 border border-border/60">
                <summary className="cursor-pointer font-semibold select-none text-foreground/80 hover:text-foreground">
                  Technical Diagnostics
                </summary>
                <p className="mt-2 text-destructive font-mono break-all whitespace-pre-wrap">
                  {errorMessage}
                </p>
              </details>
            </div>

            <p className="text-[11px] text-muted-foreground font-mono">
              ZENWAY Campus Student Mobility Exchange
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
