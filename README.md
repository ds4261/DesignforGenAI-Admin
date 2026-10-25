# Design for GenAI admin

Next.js admin application using Supabase and Google sign-in. Every data page and mutation requires a profile with `is_superadmin = true`; database policies enforce admin access as well.

## Setup

1. Install dependencies with `npm ci`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`.
3. Apply the original application's NYC caption migrations, then run these SQL files in order in the Supabase SQL Editor:
   - `supabase/migrations/202610190001_admin_access.sql`
   - `supabase/migrations/202610250001_assignment_resources.sql`
4. Enable Google authentication in Supabase and configure the app's `/auth/callback` redirect URL.
5. Sign in once to create a profile. A trusted database operator must set that account's `public.profiles.is_superadmin` to `true` using SQL Editor. Ordinary users cannot assign themselves admin privileges.
6. Run `npm run dev` and open `/admin`.

## Assignment coverage

| Admin section | Operations |
| --- | --- |
| Users (`profiles`) | Read |
| Prompt chains | Read |
| Prompt chain steps | Read |
| Prompt chain mix | Read, update |
| Terms | Create, read, update, delete |
| AI media (`nyc_caption_media`) | Read and view existing photos and generated captions; existing caption management remains available |
| Generation requests | Read |
| AI generation examples | Create, read, update, delete |
| LLM models | Create, read, update, delete |
| LLM providers | Create, read, update, delete |
| LLM responses | Read |
| Allowed signup domains | Create, read, update, delete |
| Whitelisted e-mail addresses | Create, read, update, delete |

The assignment migration creates baseline UUID tables when absent, preserves existing tables and policies, and adds admin policies for the required operations. Review it against your application's schema before applying, especially foreign-key column types if some tables already exist. It does not seed sample records. The originating application must write prompt chains, steps, mixes, requests, and responses; the admin only reads or updates them as specified.

Resource routes and table names are allowlisted in `app/admin/resources.ts`. The admin-only `admin_resource_columns` RPC supplies actual columns, required fields, types, defaults, and primary keys, so existing table fields appear in both lists and forms, including for empty tables. JSON and array fields accept JSON; booleans use a selector. Primary keys identify updates/deletes and are immutable after creation. Foreign keys accept record IDs from the corresponding section. Lists show 50 records per page. Errors and pending/success messages appear by the form, and deletes require confirmation.

Media previews use signed URLs valid for 15 minutes from the private `nyc-caption-photos` bucket; refresh the page to renew them. This admin references existing storage paths and does not upload images. The supplied assignment's conditional image-upload instruction was incomplete and needs clarification if uploads are required.

Maintaining domain and e-mail lists here does not itself enforce signup restrictions in Supabase Auth. The signup application's existing admission logic must consume those tables.

## Validation

```sh
npm run lint
npx tsc --noEmit
node --test tests/*.test.mjs
npm run build
```

The production build downloads the existing Geist fonts and needs network access to Google Fonts. Live verification also needs a reachable Supabase project with both migrations applied: test each operation as a superadmin, then confirm an ordinary account cannot access admin records or call the metadata RPC.
