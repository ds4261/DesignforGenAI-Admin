type Media = { photo_path: string; captions: string[]; system_prompt: string; user_prompt: string; model: string }

export function MediaFields({ media }: { media?: Media }) {
    return <>
        <label>Photo storage path<input name="photo_path" defaultValue={media?.photo_path} placeholder="user-id/photo.jpg" required className="block w-full rounded border p-2" /></label>
        <p className="text-sm text-gray-500">Use an existing path in the nyc-caption-photos bucket. For new media, the path must belong to your user ID.</p>
        {[0, 1, 2].map((i) => <label key={i}>Caption {i + 1}<input name={`caption_${i}`} defaultValue={media?.captions[i]} required className="block w-full rounded border p-2" /></label>)}
        <label>System prompt<textarea name="system_prompt" defaultValue={media?.system_prompt} className="block w-full rounded border p-2" /></label>
        <label>User prompt<textarea name="user_prompt" defaultValue={media?.user_prompt} className="block w-full rounded border p-2" /></label>
        <label>Model<input name="model" defaultValue={media?.model} required className="block w-full rounded border p-2" /></label>
    </>
}
