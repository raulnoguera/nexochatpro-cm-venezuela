// Crea en Chatwoot la bandeja de Messenger usando el token permanente de la página (sin 'Continuar con Facebook').
// Necesario cuando la app de Meta solo tiene 'Inicio de sesión con Facebook para empresas'. Ver docs/META.md.
// Después: agregar al usuario del bot como colaborador de la bandeja y sumarla a BOT_INBOX_IDS.
const { CHATWOOT_URL: U, CHATWOOT_TOKEN: T, CHATWOOT_ACCOUNT_ID: A, META_PAGE_ID: P, META_PAGE_TOKEN: PT } = process.env
const api = async (m, p, b) => { const r = await fetch(`${U}/api/v1/accounts/${A}${p}`, { method: m, headers: { 'api-access-token': T, 'Content-Type': 'application/json' }, body: b && JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => ({})) } }
const antes = await api('GET', '/inboxes')
console.log('bandejas antes:', JSON.stringify(antes.j.payload?.map(i => [i.id, i.name, i.channel_type])))
if (antes.j.payload?.some(i => i.channel_type === 'Channel::FacebookPage')) { console.log('ya existe una bandeja de Messenger, no se crea otra'); process.exit(0) }
const r = await api('POST', '/callbacks/register_facebook_page', { page_id: P, page_access_token: PT, user_access_token: PT, inbox_name: 'Messenger Master Cauchos' })
console.log('crear bandeja:', r.s, JSON.stringify(r.j).replaceAll(PT, '***').slice(0, 600))
const despues = await api('GET', '/inboxes')
console.log('bandejas despues:', JSON.stringify(despues.j.payload?.map(i => [i.id, i.name, i.channel_type])))
