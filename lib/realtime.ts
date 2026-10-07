// Pushes a "changed" nudge to the desktop players of one screen through Ably's REST API.
// The message carries no content: the player reacts by doing its normal one-time sync.
// Publishing is best-effort — if Ably is unconfigured or down, saving in the CMS still works
// and the player simply picks the change up on its next launch.

const PUBLISH_TIMEOUT_MS = 5000

export const screenChannel = (screenId: string) => `screen-${screenId}`

export async function publishScreenChanged(screenId: string) {
  const key = process.env.ABLY_API_KEY
  if (!key) return

  try {
    const response = await fetch(
      `https://rest.ably.io/channels/${encodeURIComponent(screenChannel(screenId))}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(key).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'changed', data: '' }),
        signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
      }
    )
    if (!response.ok) console.error('[realtime publish]', response.status, await response.text())
  } catch (error) {
    console.error('[realtime publish]', error)
  }
}
