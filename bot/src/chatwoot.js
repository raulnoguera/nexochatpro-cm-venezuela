const { CHATWOOT_URL, CHATWOOT_TOKEN, CHATWOOT_ACCOUNT_ID } = process.env
const base = `${CHATWOOT_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}`

async function api(method, p, body) {
  const r = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', 'api-access-token': CHATWOOT_TOKEN },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) throw new Error(`Chatwoot ${method} ${p} -> ${r.status} ${await r.text()}`)
  return r.status === 204 ? null : r.json()
}

export const sendMessage = (conv, content, isPrivate = false) =>
  api('POST', `/conversations/${conv}/messages`, { content, message_type: 'outgoing', private: isPrivate, content_attributes: { bot: true } })
export const setStatus = (conv, status) => api('POST', `/conversations/${conv}/toggle_status`, { status })
// La API reemplaza toda la lista, así que se combina con las etiquetas existentes
export const addLabels = async (conv, labels) => {
  const { payload } = await api('GET', `/conversations/${conv}/labels`)
  return api('POST', `/conversations/${conv}/labels`, { labels: [...new Set([...payload, ...labels])] })
}
export const contacto = async id => (await api('GET', `/contacts/${id}`)).payload
export const updateContact = (id, data) => api('PUT', `/contacts/${id}`, data)
export const history = async conv => (await api('GET', `/conversations/${conv}/messages`)).payload
export const abiertas = async () =>
  (await api('GET', '/conversations?status=open')).data.payload
export const inboxes = async () => (await api('GET', '/inboxes')).payload
export const teams = () => api('GET', '/teams')
export const asignarEquipo = (conv, equipo) => api('POST', `/conversations/${conv}/assignments`, { team_id: equipo })
