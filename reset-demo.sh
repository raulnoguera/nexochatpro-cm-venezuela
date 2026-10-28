#!/bin/sh
# Deja la demo limpia: borra conversaciones, contactos de prueba y citas.
cd "$(dirname "$0")"
rm -f bot/data/citas.json
(cd chatwoot && docker compose exec -T rails bundle exec rails runner 'Conversation.destroy_all; Contact.destroy_all; puts "demo limpia"')
