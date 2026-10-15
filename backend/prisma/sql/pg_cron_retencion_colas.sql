-- Politica de retencion de las colas de donaciones.
-- NO es una migracion de Prisma: ejecutar manualmente en el SQL Editor de Supabase.
-- Corre todos los dias a las 03:00 UTC y no llama a ningun servicio externo.
--   * Mensajes archivados (ya procesados): se conservan 7 dias.
--   * Mensajes en los DLQ (fallidos): se conservan 30 dias.
-- Cubre las colas de los dos suscriptores: recibo y admin.

create extension if not exists pg_cron;

select cron.schedule(
  'retencion-colas-donaciones',
  '0 3 * * *',
  $$
  delete from pgmq.a_donaciones_recibo
   where archived_at < now() - interval '7 days';

  delete from pgmq.a_donaciones_admin
   where archived_at < now() - interval '7 days';

  select pgmq.delete('donaciones_recibo_dlq', array_agg(msg_id))
    from pgmq.q_donaciones_recibo_dlq
   where enqueued_at < now() - interval '30 days'
  having count(*) > 0;

  select pgmq.delete('donaciones_admin_dlq', array_agg(msg_id))
    from pgmq.q_donaciones_admin_dlq
   where enqueued_at < now() - interval '30 days'
  having count(*) > 0;
  $$
);

-- Si el job ya existe, desprogramarlo antes de volver a crearlo:
--   select cron.unschedule('retencion-colas-donaciones');