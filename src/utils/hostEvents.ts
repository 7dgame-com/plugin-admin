type HostEventPayload = {
  event: string
}

type HostEventMessage = {
  type: 'EVENT'
  id: string
  payload: HostEventPayload
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function postHostEvent(payload: HostEventPayload): void {
  const message: HostEventMessage = {
    type: 'EVENT',
    id: createMessageId(),
    payload,
  }

  window.parent.postMessage(message, '*')
}

export function notifyHostPluginRegistryChanged(): void {
  postHostEvent({ event: 'plugin-registry-changed' })
}
