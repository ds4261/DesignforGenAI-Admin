'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminNavigation() {
    const pathname = usePathname()
    return <div className="nav-links">
        {[
            ['/admin', 'Dashboard'], ['/admin/users', 'Users'],
            ['/admin/media', 'AI media'], ['/admin/votes', 'Votes'],
        ].map(([href, label]) => <Link key={href} href={href}
            aria-current={(href === '/admin' ? pathname === href : pathname.startsWith(href)) ? 'page' : undefined}>
            {label}
        </Link>)}
    </div>
}
