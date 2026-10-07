-- Colas pgmq para el envio asincrono del recibo de donacion.
-- La extension ya esta habilitada en Supabase; 'if not exists' deja la migracion
-- idempotente en otros entornos. pgmq.create() tambien es idempotente.
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Cola principal: un mensaje por donacion creada.
SELECT pgmq.create('donaciones_recibo');

-- Dead letter queue: mensajes que agotaron sus reintentos o son invalidos.
SELECT pgmq.create('donaciones_recibo_dlq');