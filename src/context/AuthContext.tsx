import * as React from "react"
import type { User, Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { Database } from "@/types/database.types"

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type StudentVerification = Database["public"]["Tables"]["student_verifications"]["Row"]

export interface SignUpData {
  email: string
  password: string
  fullName: string
  phoneNumber?: string
  universityName?: string
}

export interface AdminRegistrationRecord {
  id: string
  full_name: string
  email?: string | null
  phone_number?: string | null
  university_name?: string | null
  role: Database["public"]["Enums"]["user_role"]
  verification_status: Database["public"]["Enums"]["account_verification_status"]
  registration_status: Database["public"]["Enums"]["registration_approval_status"]
  registration_rejection_reason?: string | null
  created_at: string
  registration_reviewed_at?: string | null
  registration_reviewed_by?: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  latestVerification: StudentVerification | null
  isLoading: boolean
  error: string | null
  signUp: (data: SignUpData) => Promise<{ user: User | null; session: Session | null }>
  signIn: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>
  signOut: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  refreshProfile: () => Promise<void>
  approveRegistration: (targetUserId: string) => Promise<void>
  rejectRegistration: (targetUserId: string, reason: string) => Promise<void>
  getAdminRegistrations: (statusFilter?: string) => Promise<AdminRegistrationRecord[]>
  adminAccessKeyVerified: boolean
  verifyAdminAccessKey: (key: string) => Promise<boolean>
  updateAdminAccessKey: (oldKey: string, newKey: string) => Promise<boolean>
  adminSignOut: () => Promise<void>
  isVerified: boolean
  isPending: boolean
  isUnverified: boolean
  isSuspended: boolean
  isAdmin: boolean
  isRegistrationApproved: boolean
  isRegistrationPending: boolean
  isRegistrationRejected: boolean
  registrationRejectionReason: string | null
}

const AuthContext = React.createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [session, setSession] = React.useState<Session | null>(null)
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [latestVerification, setLatestVerification] = React.useState<StudentVerification | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [adminAccessKeyVerified, setAdminAccessKeyVerified] = React.useState<boolean>(() => {
    try {
      return (
        sessionStorage.getItem("zenway_admin_key_verified") === "true" ||
        localStorage.getItem("zenway_admin_key_verified") === "true"
      )
    } catch {
      return false
    }
  })

  // Fetch student profile and latest verification submission
  const fetchProfileAndVerification = React.useCallback(async (userId: string) => {
    try {
      // 1. Fetch Profile with explicit permitted columns (excludes phone_number to satisfy privacy restrictions)
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select(
          "id, full_name, university_name, avatar_url, bio, role, verification_status, registration_status, registration_rejection_reason, registration_reviewed_at, registration_reviewed_by, created_at, updated_at"
        )
        .eq("id", userId)
        .maybeSingle()

      if (profileErr) {
        console.error("[Auth] Error fetching profile:", profileErr)
      } else if (profileData) {
        // Enforce registration approval guard for restored non-admin sessions
        const isUserAdmin = profileData.role === "admin"
        const regStatus = (profileData as any).registration_status

        if (!isUserAdmin && (regStatus === "pending" || regStatus === "rejected")) {
          console.warn("[Auth] Active session blocked due to registration status:", regStatus)
          await supabase.auth.signOut()
          setUser(null)
          setSession(null)
          setProfile(null)
          setLatestVerification(null)
          return
        }

        setProfile(profileData as Profile)
      }

      // 2. Fetch Latest Student Verification Submission
      const { data: verificationData, error: verErr } = await supabase
        .from("student_verifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (verErr) {
        console.error("[Auth] Error fetching verification:", verErr)
      } else {
        setLatestVerification(verificationData ?? null)
      }
    } catch (err) {
      console.error("[Auth] Exception loading user data:", err)
    }
  }, [])

  // Initial session restoration and auth state listener
  React.useEffect(() => {
    let isMounted = true

    const initAuth = async () => {
      try {
        const { data, error: sessionErr } = await supabase.auth.getSession()
        if (sessionErr) throw sessionErr

        if (isMounted) {
          if (data.session?.user) {
            setSession(data.session)
            setUser(data.session.user)
            await fetchProfileAndVerification(data.session.user.id)
          } else {
            setSession(null)
            setUser(null)
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("[Auth] Session restoration error:", err)
          setError(err instanceof Error ? err.message : "Failed to restore session")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return

      if (newSession?.user) {
        setSession(newSession)
        setUser(newSession.user)
        await fetchProfileAndVerification(newSession.user.id)
      } else {
        setSession(null)
        setUser(null)
        setProfile(null)
        setLatestVerification(null)
      }
      setIsLoading(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfileAndVerification])

  const refreshProfile = React.useCallback(async () => {
    if (user) {
      await fetchProfileAndVerification(user.id)
    }
  }, [user, fetchProfileAndVerification])

  // Email / Password Registration
  const signUp = React.useCallback(
    async ({ email, password, fullName, phoneNumber, universityName }: SignUpData) => {
      setError(null)
      const redirectUrl = `${window.location.origin}/auth/callback`

      const { data, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone_number: phoneNumber || null,
            university_name: universityName || null,
          },
        },
      })

      if (signUpErr) {
        setError(signUpErr.message)
        throw signUpErr
      }

      // If email auto-confirmed and session returned, log out immediately
      // because administrator approval is strictly required before login.
      if (data.session) {
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setProfile(null)
      }

      return data
    },
    []
  )

  // Login with Backend Registration Approval Check
  const signIn = React.useCallback(
    async (email: string, password: string) => {
      setError(null)

      // 1. Authenticate with Supabase Auth
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInErr) {
        const msg = signInErr.message || ""
        if (msg.includes("REGISTRATION_REJECTED")) {
          const cleanReason = msg.replace(/^.*REGISTRATION_REJECTED:\s*/, "")
          const error = new Error(`REGISTRATION_REJECTED: ${cleanReason || "Your registration was rejected by campus administration."}`)
          setError(error.message)
          throw error
        }
        if (msg.includes("REGISTRATION_PENDING") || msg.includes("Error running hook URI") || msg.includes("custom_access_token_hook")) {
          const error = new Error("REGISTRATION_PENDING: Your registration has been submitted and is pending administrator review and approval. You will receive access once approved by a campus administrator.")
          setError(error.message)
          throw error
        }

        setError(signInErr.message)
        throw signInErr
      }

      // 2. Fetch Profile from Database to verify Registration Approval Status
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id, full_name, university_name, avatar_url, bio, role, verification_status, registration_status, registration_rejection_reason, registration_reviewed_at, registration_reviewed_by, created_at, updated_at"
        )
        .eq("id", data.user.id)
        .maybeSingle()

      if (profErr) {
        console.error("[Auth] Profile verification check error:", profErr)
      }

      if (prof) {
        const isUserAdmin = prof.role === "admin"
        const regStatus = (prof as any).registration_status

        // Non-admin users MUST be approved before login is permitted
        if (!isUserAdmin) {
          if (regStatus === "pending") {
            // Immediately sign out to invalidate session locally
            await supabase.auth.signOut()
            setUser(null)
            setSession(null)
            setProfile(null)
            throw new Error(
              "REGISTRATION_PENDING: Your registration has been submitted and is pending administrator review and approval. You will receive access once approved by a campus administrator."
            )
          }

          if (regStatus === "rejected") {
            // Immediately sign out to invalidate session locally
            await supabase.auth.signOut()
            setUser(null)
            setSession(null)
            setProfile(null)
            const reason = (prof as any).registration_rejection_reason || "Registration requirements were not satisfied."
            throw new Error(
              `REGISTRATION_REJECTED: Your registration was rejected by campus administration. Reason: "${reason}"`
            )
          }
        }
      }

      setUser(data.user)
      setSession(data.session)
      if (data.user) {
        await fetchProfileAndVerification(data.user.id)
      }

      return data
    },
    [fetchProfileAndVerification]
  )

  // Sign Out
  const signOut = React.useCallback(async () => {
    setError(null)
    try {
      sessionStorage.removeItem("zenway_admin_key_verified")
      localStorage.removeItem("zenway_admin_key_verified")
    } catch {}
    setAdminAccessKeyVerified(false)
    try {
      await supabase.auth.signOut()
    } catch (signOutErr) {
      console.warn("[Auth] Supabase signOut warning:", signOutErr)
    } finally {
      // Unconditionally wipe application auth state to guarantee logout
      setUser(null)
      setSession(null)
      setProfile(null)
      setLatestVerification(null)
    }
  }, [])

  // Admin Access Key Verification via RPC (with graceful profile role check if migration 14 pending)
  const verifyAdminAccessKey = React.useCallback(async (key: string): Promise<boolean> => {
    const trimmed = key.trim()
    try {
      const { data, error: rpcErr } = await (supabase.rpc as any)("verify_admin_access_key", {
        p_key: trimmed,
      })

      if (!rpcErr) {
        if (data === true) {
          setAdminAccessKeyVerified(true)
          try {
            sessionStorage.setItem("zenway_admin_key_verified", "true")
            localStorage.setItem("zenway_admin_key_verified", "true")
          } catch {}
          return true
        }
        return false
      }

      // Check if the RPC is not yet deployed to remote Supabase (schema cache error)
      const isMissingRpc =
        rpcErr.message?.includes("schema cache") ||
        rpcErr.code === "PGRST202" ||
        rpcErr.code === "42883"

      if (isMissingRpc) {
        console.warn("[Auth] verify_admin_access_key RPC not found on Supabase. Checking verified admin role in profiles table...")
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (!currentUser) {
          throw new Error("Administrator session not found. Please sign in again.")
        }

        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", currentUser.id)
          .maybeSingle()

        if (prof?.role !== "admin") {
          throw new Error("Access Denied: This account does not possess campus administrator privileges.")
        }

        if (trimmed === "2077") {
          console.info("[Auth] Admin authenticated via emergency key fallback (migration 14 pending remote deployment).")
          setAdminAccessKeyVerified(true)
          try {
            sessionStorage.setItem("zenway_admin_key_verified", "true")
            localStorage.setItem("zenway_admin_key_verified", "true")
          } catch {}
          return true
        }

        throw new Error("Invalid Admin Access Key. The default administrator security key is 2077.")
      }

      throw rpcErr
    } catch (err: any) {
      // If error is schema cache, check fallback before throwing
      if (err?.message?.includes("schema cache") || err?.code === "PGRST202" || err?.code === "42883") {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", currentUser.id)
            .maybeSingle()

          if (prof?.role === "admin") {
            if (trimmed === "2077") {
              setAdminAccessKeyVerified(true)
              try {
                sessionStorage.setItem("zenway_admin_key_verified", "true")
                localStorage.setItem("zenway_admin_key_verified", "true")
              } catch {}
              return true
            }
            throw new Error("Invalid Admin Access Key. The default administrator security key is 2077.")
          }
          throw new Error("Access Denied: Account lacks administrator privileges.")
        }
      }
      console.error("[Auth] Admin access key verification error:", err)
      throw err
    }
  }, [])

  // Admin Access Key Update via RPC
  const updateAdminAccessKey = React.useCallback(async (oldKey: string, newKey: string): Promise<boolean> => {
    try {
      const { data, error: rpcErr } = await (supabase.rpc as any)("update_admin_access_key", {
        p_old_key: oldKey.trim(),
        p_new_key: newKey.trim(),
      })
      if (!rpcErr) return !!data

      if (rpcErr.message?.includes("schema cache") || rpcErr.code === "PGRST202" || rpcErr.code === "42883") {
        throw new Error("Admin key rotation requires migration 14 to be deployed on Supabase. Default emergency key is 2077.")
      }
      throw rpcErr
    } catch (err: any) {
      console.error("[Auth] Admin key update error:", err)
      throw err
    }
  }, [])

  // Admin Sign Out
  const adminSignOut = React.useCallback(async () => {
    try {
      sessionStorage.removeItem("zenway_admin_key_verified")
      localStorage.removeItem("zenway_admin_key_verified")
    } catch {}
    setAdminAccessKeyVerified(false)
    await signOut()
  }, [signOut])

  // Forgot Password / Password Reset Request
  const resetPasswordForEmail = React.useCallback(async (email: string) => {
    setError(null)
    const redirectUrl = `${window.location.origin}/auth/callback?type=recovery`
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    })

    if (resetErr) {
      setError(resetErr.message)
      throw resetErr
    }
  }, [])

  // Update Password (when logged in or via recovery session)
  const updatePassword = React.useCallback(async (password: string) => {
    setError(null)
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    if (updateErr) {
      setError(updateErr.message)
      throw updateErr
    }
  }, [])

  // Administrative Action: Approve Registration
  const approveRegistration = React.useCallback(
    async (targetUserId: string) => {
      // 1. Try RPC approve_registration
      const { error: rpcErr } = await (supabase.rpc as any)("approve_registration", {
        p_user_id: targetUserId,
      })

      if (rpcErr) {
        console.warn("[Auth] approve_registration RPC fallback to table update:", rpcErr)
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({
            registration_status: "approved" as any,
            registration_rejection_reason: null as any,
            registration_reviewed_at: new Date().toISOString() as any,
            registration_reviewed_by: user?.id as any,
          })
          .eq("id", targetUserId)

        if (updateErr) throw updateErr
      }
    },
    [user]
  )

  // Administrative Action: Reject Registration
  const rejectRegistration = React.useCallback(
    async (targetUserId: string, reason: string) => {
      // 1. Try RPC reject_registration
      const { error: rpcErr } = await (supabase.rpc as any)("reject_registration", {
        p_user_id: targetUserId,
        p_rejection_reason: reason,
      })

      if (rpcErr) {
        console.warn("[Auth] reject_registration RPC fallback to table update:", rpcErr)
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({
            registration_status: "rejected" as any,
            registration_rejection_reason: reason as any,
            registration_reviewed_at: new Date().toISOString() as any,
            registration_reviewed_by: user?.id as any,
          })
          .eq("id", targetUserId)

        if (updateErr) throw updateErr
      }
    },
    [user]
  )

  // Administrative Action: Query Registrations with User Details
  const getAdminRegistrations = React.useCallback(
    async (statusFilter?: string): Promise<AdminRegistrationRecord[]> => {
      // 1. Try RPC get_admin_registrations
      const { data: rpcData, error: rpcErr } = await (supabase.rpc as any)(
        "get_admin_registrations",
        {
          p_status: statusFilter || null,
        }
      )

      if (!rpcErr && rpcData) {
        return rpcData as AdminRegistrationRecord[]
      }

      console.warn("[Auth] get_admin_registrations RPC fallback to table query:", rpcErr)
      let query = supabase
        .from("profiles")
        .select(
          "id, full_name, university_name, role, verification_status, registration_status, registration_rejection_reason, created_at, registration_reviewed_at, registration_reviewed_by"
        )
        .order("created_at", { ascending: false })
      if (statusFilter) {
        query = query.eq("registration_status" as any, statusFilter)
      }
      const { data, error } = await query
      if (error) throw error
      return (data || []) as unknown as AdminRegistrationRecord[]
    },
    []
  )

  // Extract JWT claims from current access token
  const jwtClaims = React.useMemo(() => {
    if (!session?.access_token) return null
    try {
      const parts = session.access_token.split(".")
      if (parts.length >= 2) {
        return JSON.parse(atob(parts[1]))
      }
    } catch {
      return null
    }
    return null
  }, [session?.access_token])

  const jwtRole = jwtClaims?.user_role || (session?.user?.app_metadata as any)?.user_role || null
  const jwtRegistrationStatus = jwtClaims?.registration_status || (session?.user?.app_metadata as any)?.registration_status || null

  // Computed state helpers
  const isVerified = profile?.verification_status === "verified"
  const isPending = profile?.verification_status === "pending"
  const isUnverified = profile?.verification_status === "unverified" || !profile?.verification_status
  const isSuspended = profile?.verification_status === "suspended"
  const isAdmin = profile?.role === "admin" || jwtRole === "admin"

  const isRegistrationApproved =
    (profile as any)?.registration_status === "approved" ||
    profile?.role === "admin" ||
    jwtRole === "admin" ||
    jwtRegistrationStatus === "approved"
  const isRegistrationPending =
    !isAdmin && ((profile as any)?.registration_status === "pending" || jwtRegistrationStatus === "pending")
  const isRegistrationRejected =
    !isAdmin && ((profile as any)?.registration_status === "rejected" || jwtRegistrationStatus === "rejected")
  const registrationRejectionReason =
    (profile as any)?.registration_rejection_reason || null

  const value = React.useMemo(
    () => ({
      user,
      session,
      profile,
      latestVerification,
      isLoading,
      error,
      signUp,
      signIn,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      refreshProfile,
      approveRegistration,
      rejectRegistration,
      getAdminRegistrations,
      adminAccessKeyVerified,
      verifyAdminAccessKey,
      updateAdminAccessKey,
      adminSignOut,
      isVerified,
      isPending,
      isUnverified,
      isSuspended,
      isAdmin,
      isRegistrationApproved,
      isRegistrationPending,
      isRegistrationRejected,
      registrationRejectionReason,
    }),
    [
      user,
      session,
      profile,
      latestVerification,
      isLoading,
      error,
      signUp,
      signIn,
      signOut,
      resetPasswordForEmail,
      updatePassword,
      refreshProfile,
      approveRegistration,
      rejectRegistration,
      getAdminRegistrations,
      adminAccessKeyVerified,
      verifyAdminAccessKey,
      updateAdminAccessKey,
      adminSignOut,
      isVerified,
      isPending,
      isUnverified,
      isSuspended,
      isAdmin,
      isRegistrationApproved,
      isRegistrationPending,
      isRegistrationRejected,
      registrationRejectionReason,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
