import { prisma } from "../lib/prisma";
import { COLAS, archivarMensaje, enviarMensaje } from "../lib/queue";

// Solo estas colas se pueden administrar (el nombre va dentro del SQL, asi que se valida).
const DLQS: string[] = [COLAS.reciboDonacionDlq, COLAS.adminDonacionDlq];
const COLAS_ORIGEN: string[] = [COLAS.reciboDonacion, COLAS.adminDonacion];

// Colas que se pueden consultar en el detalle (el nombre va dentro del SQL, asi que se valida).
const COLAS_VISIBLES: string[] = Object.values(COLAS);

interface FilaMensaje {
    msg_id: bigint;
    read_ct: bigint;
    enqueued_at: Date;
    message: unknown;
}

interface FilaArchivo extends FilaMensaje {
    archived_at: Date;
}

interface FilaMetrica {
    queue_name: string;
    queue_length: bigint;
    newest_msg_age_sec: number | null;
    oldest_msg_age_sec: number | null;
    total_messages: bigint;
}

const aMensaje = (f: FilaMensaje) => ({
    msgId: Number(f.msg_id),
    intentos: Number(f.read_ct),
    encoladoEn: f.enqueued_at,
    mensaje: f.message,
});

export class GestionColasService {
    private validarDlq(cola: string) {
        if (!DLQS.includes(cola)) {
            throw new Error("Cola DLQ no valida");
        }
    }

    private validarCola(cola: string) {
        if (!COLAS_VISIBLES.includes(cola)) {
            throw new Error("Cola no valida");
        }
    }

    // Metricas de todas las colas (largo, antiguedad, total historico).
    async metricas() {
        const filas = await prisma.$queryRaw<FilaMetrica[]>`
            select queue_name, queue_length, newest_msg_age_sec, oldest_msg_age_sec, total_messages
            from pgmq.metrics_all()
        `;

        return filas.map((f) => ({
            cola: f.queue_name,
            largo: Number(f.queue_length),
            masNuevoSeg: f.newest_msg_age_sec,
            masAntiguoSeg: f.oldest_msg_age_sec,
            totalHistorico: Number(f.total_messages),
        }));
    }

    // Detalle de una cola: mensajes pendientes y ultimos procesados (archivados).
    // Lee las tablas directo, sin pgmq.read, para no consumir ni ocultar mensajes.
    async detalleCola(cola: string, limite = 20) {
        this.validarCola(cola);
        const tope = Math.min(Math.max(Math.trunc(limite) || 20, 1), 100);

        const pendientes = await prisma.$queryRawUnsafe<FilaMensaje[]>(
            `select msg_id, read_ct, enqueued_at, message from pgmq.q_${cola} order by msg_id desc limit ${tope}`
        );

        const procesados = await prisma.$queryRawUnsafe<FilaArchivo[]>(
            `select msg_id, read_ct, enqueued_at, archived_at, message from pgmq.a_${cola} order by archived_at desc limit ${tope}`
        );

        const conteo = await prisma.$queryRawUnsafe<{ total: bigint }[]>(
            `select count(*)::bigint as total from pgmq.a_${cola}`
        );

        return {
            cola,
            pendientes: pendientes.map(aMensaje),
            procesados: procesados.map((f) => ({ ...aMensaje(f), archivadoEn: f.archived_at })),
            totalProcesados: Number(conteo[0]?.total ?? 0),
        };
    }

    async listarDlq(cola: string, limite = 50) {
        this.validarDlq(cola);
        const tope = Math.min(Math.max(Math.trunc(limite) || 50, 1), 200);

        const filas = await prisma.$queryRawUnsafe<FilaMensaje[]>(
            `select msg_id, read_ct, enqueued_at, message from pgmq.q_${cola} order by msg_id limit ${tope}`
        );

        return filas.map(aMensaje);
    }

    // Devuelve el mensaje original a su cola de origen y lo saca de la DLQ (en una transaccion).
    async reprocesar(cola: string, msgId: number) {
        this.validarDlq(cola);

        return prisma.$transaction(async (tx) => {
            const filas = await tx.$queryRawUnsafe<FilaMensaje[]>(
                `select msg_id, read_ct, enqueued_at, message from pgmq.q_${cola} where msg_id = $1::bigint`,
                msgId
            );

            if (filas.length === 0) {
                throw new Error("Mensaje no encontrado en la DLQ");
            }

            const { original, origen } = filas[0].message as { original: unknown; origen: string };

            if (!COLAS_ORIGEN.includes(origen)) {
                throw new Error("El mensaje no tiene una cola de origen valida");
            }

            const nuevoMsgId = await enviarMensaje(tx, origen, original);
            await tx.$queryRaw`select * from pgmq.delete(${cola}::text, ${msgId}::bigint)`;

            return { reprocesadoEn: origen, nuevoMsgId };
        });
    }

    async purgarDlq(cola: string) {
        this.validarDlq(cola);

        const filas = await prisma.$queryRaw<{ purge_queue: bigint }[]>`
            select * from pgmq.purge_queue(${cola}::text)
        `;

        return { eliminados: Number(filas[0]?.purge_queue ?? 0) };
    }

    async listarAlertas(limite = 50) {
        const tope = Math.min(Math.max(Math.trunc(limite) || 50, 1), 200);

        const filas = await prisma.$queryRaw<FilaMensaje[]>`
            select msg_id, read_ct, enqueued_at, message
            from pgmq.q_alertas_sistema
            order by msg_id desc
            limit ${tope}::integer
        `;

        return filas.map(aMensaje);
    }

    // Confirmar una alerta = archivarla (queda en pgmq.a_alertas_sistema para auditoria).
    async confirmarAlerta(msgId: number) {
        const ok = await archivarMensaje(COLAS.alertas, msgId);

        if (!ok) {
            throw new Error("Alerta no encontrada");
        }

        return { confirmada: msgId };
    }
}