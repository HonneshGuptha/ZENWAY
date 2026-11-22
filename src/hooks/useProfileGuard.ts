import * as React from "react"
import { useAuth } from "@/context/AuthContext"

export function useProfileGuard() {
  const { isAdmin, isProfileComplete, missingProfileFields } = useAuth()
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const pendingActionRef = React.useRef<(() => void | Promise<void>) | null>(null)
  const [serviceContext, setServiceContext] = React.useState<string>("this service")

  const requireCompleteProfile = React.useCallback(
    (action: () => void | Promise<void>, serviceDesc = "this service"): boolean => {
      // Administrators are unconditionally exempt
      if (isAdmin) {
        action()
        return true
      }

      if (isProfileComplete) {
        action()
        return true
      }

      // Incomplete non-admin profile: hold action and open inline completion modal
      setServiceContext(serviceDesc)
      pendingActionRef.current = action
      setIsModalOpen(true)
      return false
    },
    [isAdmin, isProfileComplete]
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
  }, [])

  return {
    isProfileComplete: isAdmin || isProfileComplete,
    missingProfileFields,
    isModalOpen,
    serviceContext,
    requireCompleteProfile,
    handleModalSuccess,
    handleModalClose,
  }
}
