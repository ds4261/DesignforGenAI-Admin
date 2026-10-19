'use client'
import { createClient } from '@/utils/supabase/client'

export default function LoginPage() {
    const signIn = async () => {
        const supabase = createClient()
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        })
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-6">
            <h1 className="text-3xl font-bold">Admin Login</h1>
            <button
                onClick={signIn}
                className="rounded bg-black px-6 py-3 text-white"
            >
                Sign in with Google
            </button>
        </main>
    )
}