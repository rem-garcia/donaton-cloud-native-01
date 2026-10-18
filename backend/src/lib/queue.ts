import type { PrismaClient } from "../../prisma/generated/prisma/client";
import { prisma } from "./prisma";

// Wrapper fino sobre la API SQL de pgmq (https://supabase.com/docs/guides/queues/pgmq).
// Se usa $queryRaw porque Prisma no conoce el schema 'pgmq'.

// Sirve tanto para el cliente normal como para el 'tx' de una transaccion interactiva,
// lo que permite encolar en la misma transaccion que escribe en las tablas de negocio.
type Db = Pick<PrismaClient, "$queryRaw">;

export const COLAS = {
    reciboDonacion: "donaciones_recibo",
    reciboDonacionDlq: "donaciones_recibo_dlq",
    adminDonacion: "donaciones_admin",
    adminDonacionDlq: "donaciones_admin_dlq",
    //se agregan colas de alertas:
    alertas: "alertas_sistema",
} as const;

export interface MensajeCola<T> {
    msgId: number;
    readCt: number;
    enqueuedAt: Date;
    message: T;
}

interface FilaMensaje {
    msg_id: bigint;
    read_ct: bigint;
    enqueued_at: Date;
    message: unknown;
}

// pgmq.send(queue, msg, delay) -> id del mensaje
export async function enviarMensaje(db: Db, cola: string, mensaje: unknown, delaySeg = 0): Promise<number> {
    const filas = await db.$queryRaw<{ send: bigint }[]>`
        select * from pgmq.send(${cola}::text, ${JSON.stringify(mensaje)}::jsonb, ${delaySeg}::integer)
    `;

    return Number(filas[0].send);
}

// pgmq.read(queue, vt, qty): los mensajes quedan invisibles 'vtSeg' segundos y 'read_ct' aumenta en 1.
export async function leerMensajes<T>(cola: string, vtSeg: number, cantidad: number): Promise<MensajeCola<T>[]> {
    const filas = await prisma.$queryRaw<FilaMensaje[]>`
        select msg_id, read_ct, enqueued_at, message
        from pgmq.read(${cola}::text, ${vtSeg}::integer, ${cantidad}::integer)
    `;

    return filas.map((f) => ({
        msgId: Number(f.msg_id),
        readCt: Number(f.read_ct),
        enqueuedAt: f.enqueued_at,
        message: f.message as T,
    }));
}

// Procesado con exito: se conserva en la tabla de archivo (pgmq.a_<cola>) para auditoria.
export async function archivarMensaje(cola: string, msgId: number): Promise<boolean> {
    const filas = await prisma.$queryRaw<{ archive: boolean }[]>`
        select * from pgmq.archive(${cola}::text, ${msgId}::bigint)
    `;

    return filas[0]?.archive === true;
}

// Reprograma el mensaje: vuelve a ser visible dentro de 'segundos' (usado para el backoff).
export async function reprogramarMensaje(cola: string, msgId: number, segundos: number): Promise<void> {
    await prisma.$queryRaw`
        select msg_id from pgmq.set_vt(${cola}::text, ${msgId}::bigint, ${segundos}::integer)
    `;
}

// Dead letter: copia el mensaje a la DLQ y lo borra de la cola origen en UNA transaccion,
// asi nunca queda duplicado ni se pierde si algo falla a mitad de camino.
export async function moverADlq(
    colaOrigen: string,
    colaDlq: string,
    mensaje: MensajeCola<unknown>,
    motivo: string
): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await enviarMensaje(tx, colaDlq, {
            original: mensaje.message,
            origen: colaOrigen,
            msgIdOriginal: mensaje.msgId,
            intentos: mensaje.readCt,
            motivo,
            movidoEn: new Date().toISOString(),
        });

        // Alerta: avisa que un mensaje cayo en una DLQ (misma transaccion)
        await enviarMensaje(tx, COLAS.alertas, {
            tipo: "MensajeEnDlq",
            dlq: colaDlq,
            origen: colaOrigen,
            msgIdOriginal: mensaje.msgId, motivo,
            creadoEn: new Date().toISOString(),
        });

        await tx.$queryRaw`select * from pgmq.delete(${colaOrigen}::text, ${mensaje.msgId}::bigint)`;
    });
}
export const TOPICOS = {
    donacionCreada: "donacion.creada",
} as const;

const SUSCRIPCIONES: Record<string, string[]> = {
    [TOPICOS.donacionCreada]: [COLAS.reciboDonacion, COLAS.adminDonacion],
};

export async function publicarEvento(db: Db, topico: string, mensaje: unknown) {
    const colas = SUSCRIPCIONES[topico] ?? [];
    for (const cola of colas) {
      await enviarMensaje(db, cola, mensaje);
    }
    return colas;
}