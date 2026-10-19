'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
    const [error, setError] = useState('')
    const signIn = async () => {
        const supabase = createClient()
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) setError(error.message)
    }

    return (
        <main className="login-page">
            <h1 className="page-heading">Admin Login</h1>
            <p className="max-w-md text-center text-sm">Access requires a Google account with superadmin permission. If you were redirected here, ask the database owner to check your profile.</p>
            {error && <p role="alert">{error}</p>}
            <button
                onClick={signIn}
                className="button-primary"
            >
                Sign in with Google
            </button>
        </main>
    )
}