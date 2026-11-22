import * as React from "react"
import { useAuth } from "@/context/AuthContext"

export function useProfileGuard() {
  const { isAdmin, isProfileComplete, missingProfileFields } = useAuth()
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const pendingActionRef = React.useRef<(() => void | Promise<void>) | null>(null)
  const [serviceContext, setServiceContext] = React.useState<string>("this service")
  const isInFlightRef = React.useRef<boolean>(false)

  const executeActionSafely = React.useCallback(async (action: () => void | Promise<void>) => {
    if (isInFlightRef.current) {
      console.warn("[useProfileGuard] Action already in flight, blocked duplicate invocation.")
      return
    }
    isInFlightRef.current = true
    try {
      await action()
    } finally {
      isInFlightRef.current = false
    }
  }, [])

  const requireCompleteProfile = React.useCallback(
    (action: () => void | Promise<void>, serviceDesc = "this service"): boolean => {
      // Synchronous in-flight lock: block duplicate invocations immediately
      if (isInFlightRef.current) {
        console.warn("[useProfileGuard] Blocked duplicate execution attempt while action in flight.")
        return false
      }

      // Administrators are unconditionally exempt
      if (isAdmin) {
        void executeActionSafely(action)
        return true
      }

      if (isProfileComplete) {
        void executeActionSafely(action)
        return true
      }

      // Incomplete non-admin profile: hold action and open inline completion modal
      setServiceContext(serviceDesc)
      pendingActionRef.current = () => executeActionSafely(action)
      setIsModalOpen(true)
      return false
    },
    [isAdmin, isProfileComplete, executeActionSafely]
  )

  const handleModalSuccess = React.useCallback(async () => {
    setIsModalOpen(false)
    const action = pendingActionRef.current
    pendingActionRef.current = null
    if (action) {
      await action()
    }
  }, [])

  const handleModalClose = React.useCallback(() => {
    setIsModalOpen(false)
    pendingActionRef.current = null
    isInFlightRef.current = false
  }, [])

  return {
    isProfileComplete: isAdmin || isProfileComplete,
    missingProfileFields,
    isModalOpen,
    serviceContext,
    requireCompleteProfile,
    handleModalSuccess,
    handleModalClose,
    isInFlightRef,
  }
}
