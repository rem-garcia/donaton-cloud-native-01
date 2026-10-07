-- NO es una migracion de Prisma: depende de la URL y el secreto de cada entorno.
-- Ejecutar manualmente en el SQL Editor de Supabase una vez que el backend este desplegado
-- en una URL publica (pg_net no puede llamar a localhost).
--
-- Reemplaza:
--   https://TU_BACKEND         -> URL publica del backend
--   TU_WORKER_SECRET           -> mismo valor que la variable WORKER_SECRET del backend
-- Para no dejar el secreto en texto plano, puedes guardarlo en Supabase Vault y leerlo
-- con vault.decrypted_secrets en lugar de escribirlo aqui.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'worker-recibos-donacion',
  '* * * * *',  -- cada minuto
  $$
  select net.http_post(
    url     := 'https://TU_BACKEND/api/worker/donaciones',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer TU_WORKER_SECRET'
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);

-- Para detenerlo:  select cron.unschedule('worker-recibos-donacion');